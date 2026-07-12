from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.heuristics import looks_like_concert


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Artist(Base):
    __tablename__ = "artists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_download: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    concerts: Mapped[list["Concert"]] = relationship(
        back_populates="artist", cascade="all, delete-orphan", order_by="Concert.discovered_at.desc()"
    )


class Concert(Base):
    __tablename__ = "concerts"
    __table_args__ = (UniqueConstraint("artist_id", "identifier", name="uq_artist_identifier"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    artist_id: Mapped[int] = mapped_column(ForeignKey("artists.id"), nullable=False)
    identifier: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=True)
    show_date: Mapped[str | None] = mapped_column(String(64), nullable=True)
    venue: Mapped[str | None] = mapped_column(String(255), nullable=True)
    collection: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new", nullable=False)
    download_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    format_used: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    discovered_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    downloaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    artist: Mapped["Artist"] = relationship(back_populates="concerts")

    @property
    def likely_concert(self) -> bool:
        return looks_like_concert(self.title)
