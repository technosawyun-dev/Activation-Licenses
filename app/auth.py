import bcrypt
from fastapi import Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from .models import AdminUser


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def get_session_user(request: Request, db: Session) -> AdminUser | None:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if user and user.status != "active":
        return None
    return user


def require_login(request: Request, db: Session) -> AdminUser | None:
    """Returns the logged-in user or None (caller should redirect)."""
    return get_session_user(request, db)


def login_redirect() -> RedirectResponse:
    return RedirectResponse("/admin/login", status_code=302)
