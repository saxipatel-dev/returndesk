from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://returndesk:returndesk@localhost:5432/returndesk"

    # Comma separated list, e.g. "http://localhost:5173,https://returndesk.example.com"
    cors_origins: str = "http://localhost:5173"

    session_days: int = 7
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    upload_dir: Path = Path("uploads")
    max_upload_mb: int = 5

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Hosting providers usually hand out postgres:// URLs; SQLAlchemy needs the driver name.
        if value.startswith("postgres://"):
            value = "postgresql://" + value[len("postgres://") :]
        if value.startswith("postgresql://"):
            value = "postgresql+psycopg://" + value[len("postgresql://") :]
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
