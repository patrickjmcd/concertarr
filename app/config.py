from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:////app/data/concertarr.db"
    media_root: str = "/media/concerts"
    poll_interval_minutes: int = 180
    preferred_formats: str = "Flac,VBR MP3,MP3,Ogg Vorbis"
    max_concurrent_downloads: int = 2
    search_rows: int = 50
    http_timeout_seconds: int = 30
    log_level: str = "INFO"

    @property
    def preferred_format_list(self) -> list[str]:
        return [f.strip() for f in self.preferred_formats.split(",") if f.strip()]

    class Config:
        env_prefix = "CONCERTARR_"


settings = Settings()
