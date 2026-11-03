from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """All configuration comes from environment variables (see the root .env.example)."""

    model_config = SettingsConfigDict(extra="ignore")

    environment: str = "dev"

    postgres_db: str = "eduhub"
    postgres_user: str = "postgres"
    postgres_password: str = ""
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    # comma-separated lists, kept as plain strings so env values need no JSON
    allowed_hosts: str = "localhost,127.0.0.1"
    cors_allowed_origins: str = "http://localhost:5173"

    # Better Auth (Next.js) signs short-lived JWTs; the API checks them against its public keys.
    # better_auth_url is the issuer/audience inside the tokens; the JWKS URL is where keys are fetched from.
    better_auth_url: str = "http://localhost:5173"
    better_auth_jwks_url: str = ""

    media_root: Path = BASE_DIR / "media"
    enable_populate_db: bool = False

    @property
    def is_prod(self) -> bool:
        return self.environment.lower() == "prod"

    @property
    def database_url(self) -> str:
        from sqlalchemy.engine import URL

        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)

    @property
    def issuer(self) -> str:
        return self.better_auth_url.rstrip("/")

    @property
    def jwks_url(self) -> str:
        return self.better_auth_jwks_url or f"{self.issuer}/api/auth/jwks"

    @property
    def allowed_hosts_list(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts.split(",") if host.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
