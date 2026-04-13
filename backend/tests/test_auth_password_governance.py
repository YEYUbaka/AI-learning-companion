import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from core.security import get_current_admin, get_current_user, hash_password
from models.users import User
from repositories.user_repo import UserRepository
from scripts.reset_all_user_passwords import bulk_reset_passwords, validate_default_password
from services import schema_migration_service
from services.auth_service import AuthService


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    User.__table__.create(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        User.__table__.drop(bind=engine)


def create_user(db_session, email, password, role="user"):
    return UserRepository.create(
        db=db_session,
        email=email,
        name=email.split("@")[0],
        hashed_password=hash_password(password),
        role=role,
    )


def test_register_user_accepts_weak_but_legal_password(db_session):
    result = AuthService.register_user(
        db_session,
        email="weak@example.com",
        name="weak-user",
        password="weak12",
    )

    saved = db_session.query(User).filter(User.email == "weak@example.com").one()

    assert result["email"] == "weak@example.com"
    assert saved.role == "user"
    assert saved.hashed_password != "weak12"


def test_register_user_rejects_password_with_spaces(db_session):
    with pytest.raises(ValueError, match="空格"):
        AuthService.register_user(
            db_session,
            email="space@example.com",
            name="space-user",
            password="bad pass",
        )


def test_change_password_rotates_token_version_and_invalidates_old_token(db_session):
    user = create_user(db_session, "change@example.com", "weak12")
    login_result = AuthService.login_user(db_session, "change@example.com", "weak12")

    change_result = AuthService.change_password(
        db_session,
        user_id=user.id,
        current_password="weak12",
        new_password="NewPass!9",
    )

    db_session.refresh(user)

    assert user.token_version == 1
    assert change_result["user"]["id"] == user.id

    with pytest.raises(HTTPException) as old_token_error:
        asyncio.run(get_current_user(token=login_result["access_token"], db=db_session))
    assert old_token_error.value.status_code == 401

    current_user = asyncio.run(get_current_user(token=change_result["access_token"], db=db_session))
    assert current_user.id == user.id


def test_admin_reset_password_rotates_token_version_and_invalidates_old_token(db_session):
    user = create_user(db_session, "reset@example.com", "weak12")
    login_result = AuthService.login_user(db_session, "reset@example.com", "weak12")

    reset_result = AuthService.admin_reset_password(
        db_session,
        user_id=user.id,
        new_password="ResetPass!9",
    )

    db_session.refresh(user)

    assert user.token_version == 1
    assert reset_result["id"] == user.id

    with pytest.raises(HTTPException) as old_token_error:
        asyncio.run(get_current_user(token=login_result["access_token"], db=db_session))
    assert old_token_error.value.status_code == 401


def test_get_current_admin_requires_admin_role_only(db_session):
    non_admin = create_user(db_session, "admin-looking@example.com", "weak12", role="user")

    with pytest.raises(HTTPException) as admin_error:
        asyncio.run(get_current_admin(current_user=non_admin))

    assert admin_error.value.status_code == 403


def test_schema_migration_adds_token_version_column(monkeypatch):
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(bind=engine)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    name VARCHAR(100) NOT NULL,
                    hashed_password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'user',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO users (id, email, name, hashed_password, role)
                VALUES (1, 'legacy@example.com', 'legacy', 'hash', 'user')
                """
            )
        )

    monkeypatch.setattr(schema_migration_service, "engine", engine)
    monkeypatch.setattr(schema_migration_service, "SessionLocal", SessionLocal)

    schema_migration_service.SchemaMigrationService.ensure_user_auth_schema()

    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    assert "token_version" in columns

    with engine.connect() as conn:
        token_version = conn.execute(
            text("SELECT token_version FROM users WHERE id = 1")
        ).scalar_one()

    assert token_version == 0


def test_validate_default_password_requires_strong_password():
    with pytest.raises(ValueError, match="强密码"):
        validate_default_password("weak12")


def test_bulk_reset_passwords_updates_all_users_and_rotates_token_versions(db_session):
    first_user = create_user(db_session, "user1@example.com", "weak12")
    second_user = create_user(db_session, "user2@example.com", "weak34")

    result = bulk_reset_passwords(db_session, "StrongPass!9")

    db_session.refresh(first_user)
    db_session.refresh(second_user)

    assert result["updated_users"] == 2
    assert first_user.token_version == 1
    assert second_user.token_version == 1
    assert first_user.hashed_password != hash_password("StrongPass!9")
