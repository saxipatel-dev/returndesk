import secrets
from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import CSRF_HEADER, SESSION_COOKIE, hash_token
from app.models import User, UserSession
from app.models.enums import Role

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_current_session(request: Request, db: Session = Depends(get_db)) -> UserSession:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in to continue.")

    session = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if session is None or session.expires_at <= datetime.now(UTC):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your session has expired.")
    if not session.user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This account has been deactivated.")

    # Cookie auth needs CSRF protection: every state-changing request must echo the
    # per-session token that the API handed to the frontend at sign-in.
    if request.method not in SAFE_METHODS:
        sent = request.headers.get(CSRF_HEADER, "")
        if not secrets.compare_digest(sent, session.csrf_token):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Missing or invalid CSRF token.")

    return session


def get_current_user(session: UserSession = Depends(get_current_session)) -> User:
    return session.user


def require_roles(*roles: Role):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't have access to this.")
        return user

    return checker


require_customer = require_roles(Role.CUSTOMER)
require_staff = require_roles(Role.EMPLOYEE, Role.ADMIN)
require_admin = require_roles(Role.ADMIN)
