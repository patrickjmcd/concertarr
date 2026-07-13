from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ArtistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    query: str
    enabled: bool
    auto_download: bool
    created_at: datetime
    last_checked_at: datetime | None


class ConcertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    artist_id: int
    identifier: str
    title: str
    show_date: str | None
    venue: str | None
    collection: str | None
    status: str
    download_path: str | None
    format_used: str | None
    error: str | None
    discovered_at: datetime
    downloaded_at: datetime | None
    likely_concert: bool
    source: str | None = None


class ConcertWithArtistOut(ConcertOut):
    artist_name: str


class ArtistDetailOut(BaseModel):
    artist: ArtistOut
    concerts: list[ConcertOut]


class DashboardOut(BaseModel):
    artist_count: int
    status_counts: dict[str, int]


class SearchResultItem(BaseModel):
    identifier: str
    title: str
    date: str | None = None
    likely_concert: bool = True
    source: str | None = None


class PreviewOut(BaseModel):
    query: str
    results: list[SearchResultItem]
    total_found: int = 0
    error: str | None = None


class ArtistCreate(BaseModel):
    name: str
    query: str = ""
    auto_download: bool = True


class CountOut(BaseModel):
    count: int


class OkOut(BaseModel):
    ok: bool = True


class TrackItem(BaseModel):
    name: str
    title: str | None = None
    track_number: str | None = None
    length: str | None = None
    size_bytes: int | None = None
    stream_url: str | None = None


class TrackListOut(BaseModel):
    source: str  # "disk" | "preview"
    format: str | None = None
    tracks: list[TrackItem]
    error: str | None = None


class DiscoverArtistItem(BaseModel):
    name: str
    count: int
    sample_identifier: str
    sample_title: str
    monitored: bool = False
    likely_concert: bool = True
    source: str | None = None


class DiscoverArtistsOut(BaseModel):
    query: str
    artists: list[DiscoverArtistItem]
    error: str | None = None


class AJShowItem(BaseModel):
    identifier: str
    title: str
    date: str | None = None
    creator: str | None = None
    venue: str | None = None
    likely_concert: bool = True
    source: str | None = None
    monitored: bool = False
    concert_id: int | None = None
    status: str | None = None
    downloads: int | None = None


class AJShowsOut(BaseModel):
    items: list[AJShowItem]
    total_found: int = 0
    error: str | None = None


class AJDownloadRequest(BaseModel):
    identifier: str
    creator: str
    title: str = ""
    date: str | None = None
    venue: str | None = None
    collection: str | None = None
