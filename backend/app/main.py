from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import admin, auth, catalog, returns
from app.core.config import get_settings
from app.core.database import get_db

settings = get_settings()

app = FastAPI(
    title="ReturnDesk API",
    version="1.0.0",
    description="Product returns and warranty management. All routes live under /api.",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)

app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(returns.router)
app.include_router(returns.attachments_router)
app.include_router(admin.router)


@app.get("/health", tags=["health"])
@app.get("/api/health", tags=["health"], include_in_schema=False)
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse({"status": "error", "database": "unreachable"}, status_code=503)
    return {"status": "ok", "database": "ok"}
