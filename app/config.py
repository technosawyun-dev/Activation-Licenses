from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/licensedb"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ENCRYPTION_KEY: str = ""
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"
    BASE_URL: str = "http://localhost:8000"
    APP_NAME: str = "Saw Yun License Server"
    SESSION_HTTPS_ONLY: bool = False

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
