from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_session, get_current_user
from app.core.security import (
    SESSION_COOKIE,
    hash_password,
    hash_token,
    new_token,
    verify_password,
)
from app.models import User, UserSession
from app.models.enums import Role
from app.schemas import (
    LoginIn,
    PasswordChange,
    ProfileUpdate,
    RegisterIn,
    SessionOut,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Used so that login takes about the same time whether or not the email exists.
_DUMMY_HASH = hash_password("not-a-real-password-1")


def start_session(db: Session, response: Response, user: User) -> SessionOut:
    settings = get_settings()
    token = new_token()
    session = UserSession(
        user_id=user.id,
        token_hash=hash_token(token),
        csrf_token=new_token(),
        expires_at=datetime.now(UTC) + timedelta(days=settings.session_days),
    )
    db.add(session)
    # Tidy up this user's expired sessions while we're here.
    db.execute(
        delete(UserSession).where(
            UserSession.user_id == user.id, UserSession.expires_at < datetime.now(UTC)
        )
    )
    db.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    return SessionOut(user=UserOut.model_validate(user), csrf_token=session.csrf_token)


@router.post("/register", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, response: Response, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    # Public sign-up always creates a customer, whatever the browser sends.
    user = User(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        role=Role.CUSTOMER,
    )
    db.add(user)
    db.flush()
    return start_session(db, response, user)


@router.post("/login", response_model=SessionOut)
def login(data: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.email) == data.email.lower()))
    password_ok = verify_password(data.password, user.password_hash if user else _DUMMY_HASH)
    if user is None or not password_ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email or password is incorrect.")
    if not user.active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been deactivated.")
    return start_session(db, response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
):
    db.delete(db.merge(session))
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=SessionOut)
def me(session: UserSession = Depends(get_current_session)):
    # The frontend calls this on page load to restore the user and its CSRF token.
    return SessionOut(user=UserOut.model_validate(session.user), csrf_token=session.csrf_token)


@router.patch("/me", response_model=UserOut)
def update_profile(
    data: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user.name = data.name
    db.commit()
    return user


@router.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: PasswordChange,
    request: Request,
    session: UserSession = Depends(get_current_session),
    db: Session = Depends(get_db),
):
    user = session.user
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect.")
    user.password_hash = hash_password(data.new_password)
    # Sign out every other device that was using the old password.
    db.execute(
        delete(UserSession).where(UserSession.user_id == user.id, UserSession.id != session.id)
    )
    db.commit()
