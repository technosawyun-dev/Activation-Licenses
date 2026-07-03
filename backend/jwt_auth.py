from datetime import datetime, timedelta

import jwt
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import AdminUser

ALGORITHM = "HS256"
TOKEN_EXPIRE_SECONDS = 28800  # 8 hours — matches the old session cookie's max_age


def create_access_token(user: AdminUser) -> str:
    payload = {
        "sub": str(user.id),
        "exp": datetime.utcnow() + timedelta(seconds=TOKEN_EXPIRE_SECONDS),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db),
) -> AdminUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="not_authenticated")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="token_expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid_token")

    # Only the user id is trusted from the token — role/status are always
    # re-read from the DB so a suspended account (or a role change) takes
    # effect on the very next request, not just on the next login.
    user = db.query(AdminUser).filter(AdminUser.id == int(payload["sub"])).first()
    if not user or user.status != "active":
        raise HTTPException(status_code=401, detail="account_inactive")
    return user


def require_role(*roles: str):
    def checker(user: AdminUser = Depends(get_current_user)) -> AdminUser:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="permission_denied")
        return user
    return checker
