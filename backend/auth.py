import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import Session

from backend.database import Base, SessionLocal, get_db


class User(Base):
    __tablename__ = "auth_users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="viewer", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SessionToken(Base):
    __tablename__ = "auth_sessions"
    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked = Column(Boolean, default=False)


def _hash_password(password: str) -> str:
    import hashlib
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def create_user(username: str, password: str, role: str = "viewer") -> User:
    with get_db() as db:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            raise ValueError("Username already exists")
        user = User(username=username, password_hash=_hash_password(password), role=role)
        db.add(user)
        db.flush()
        return user


def ensure_default_users() -> None:
    defaults = [
        ("admin", "admin123", "admin"),
        ("operator", "op123", "operator"),
        ("viewer", "view123", "viewer"),
    ]
    with get_db() as db:
        for username, password, role in defaults:
            existing = db.query(User).filter(User.username == username).first()
            if not existing:
                db.add(User(username=username, password_hash=_hash_password(password), role=role))


def authenticate_user(username: str, password: str) -> Optional[User]:
    with get_db() as db:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return None
        if user.password_hash != _hash_password(password):
            return None
        return user


def create_session_token(user: User, ttl_minutes: int = 60 * 24) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    with get_db() as db:
        db.add(SessionToken(token=token, username=user.username, expires_at=expires_at))
        db.flush()
        return token


def get_user_from_token(token: str) -> Optional[User]:
    with get_db() as db:
        session = (
            db.query(SessionToken)
            .filter(SessionToken.token == token, SessionToken.revoked.is_(False))
            .first()
        )
        if not session:
            return None
        now = datetime.now(timezone.utc)
        if session.expires_at is None or session.expires_at.replace(tzinfo=timezone.utc) < now:
            session.revoked = True
            return None
        return db.query(User).filter(User.username == session.username).first()


def revoke_session_token(token: str) -> bool:
    with get_db() as db:
        session = db.query(SessionToken).filter(SessionToken.token == token).first()
        if not session:
            return False
        session.revoked = True
        return True
