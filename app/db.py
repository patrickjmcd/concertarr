import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    db_path = settings.database_url.removeprefix("sqlite:///")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def _add_missing_columns():
    inspector = inspect(engine)
    if "artists" not in inspector.get_table_names():
        return
    existing_cols = {c["name"] for c in inspector.get_columns("artists")}
    if "auto_download" not in existing_cols:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE artists ADD COLUMN auto_download BOOLEAN NOT NULL DEFAULT 1")
            )
