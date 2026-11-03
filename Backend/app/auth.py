import logging
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import ROLES, User

logger = logging.getLogger(__name__)


def _unauthorized(detail: str) -> HTTPException:
    # WWW-Authenticate tells clients the token itself was the problem, so they fetch a fresh one
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": 'Bearer realm="api"'})


@lru_cache(maxsize=1)
def get_jwks_client() -> jwt.PyJWKClient:
    # Caches the key set for 5 minutes and refetches once when a token names an unknown key (rotation).
    return jwt.PyJWKClient(get_settings().jwks_url, cache_keys=True, lifespan=300, timeout=5)


def decode_token(token: str) -> dict:
    settings = get_settings()
    signing_key = get_jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["EdDSA"],
        issuer=settings.issuer,
        audience=settings.issuer,
        options={"require": ["exp", "iat", "iss", "aud", "sub"]},
        leeway=30,
    )


def sync_user(db: Session, claims: dict) -> User:
    """Return the local user for verified token claims, creating or updating the mirror."""
    role = claims.get("role")
    if role not in ROLES:
        raise _unauthorized("Token has no valid role.")

    fields = {
        "email": (claims.get("email") or "")[:254],
        "name": (claims.get("name") or "")[:150],
        "role": role,
    }
    user = db.scalar(select(User).where(User.auth_id == claims["sub"]))
    if user is None:
        user = User(auth_id=claims["sub"], **fields)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            # a parallel first request created the same user; use that one
            db.rollback()
            user = db.scalar(select(User).where(User.auth_id == claims["sub"]))
    elif any(getattr(user, name) != value for name, value in fields.items()):
        for name, value in fields.items():
            setattr(user, name, value)
        db.commit()

    if user is None or not user.is_active:
        raise _unauthorized("User is inactive.")
    return user


def get_optional_user(request: Request, db: Annotated[Session, Depends(get_db)]) -> User | None:
    """The signed-in user, or None for guests. A token that is present but invalid is always a 401."""
    header = request.headers.get("authorization")
    if not header:
        return None
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token or " " in token:
        raise _unauthorized("Invalid Authorization header.")

    try:
        claims = decode_token(token)
    except jwt.PyJWKClientConnectionError as exc:
        logger.error("Could not fetch Better Auth JWKS from %s: %s", get_settings().jwks_url, exc)
        raise _unauthorized("Could not verify the token right now.") from exc
    except (jwt.PyJWKClientError, jwt.InvalidTokenError) as exc:
        raise _unauthorized("Invalid or expired token.") from exc

    return sync_user(db, claims)


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise _unauthorized("Authentication credentials were not provided.")
    return user


def require_teacher(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "teacher":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Only teachers can do this.")
    return user


OptionalUser = Annotated[User | None, Depends(get_optional_user)]
Teacher = Annotated[User, Depends(require_teacher)]
