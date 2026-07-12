export interface Artist {
  id: number
  name: string
  query: string
  enabled: boolean
  auto_download: boolean
  created_at: string
  last_checked_at: string | null
}

export interface Concert {
  id: number
  artist_id: number
  identifier: string
  title: string
  show_date: string | null
  venue: string | null
  collection: string | null
  status: string
  download_path: string | null
  format_used: string | null
  error: string | null
  discovered_at: string
  downloaded_at: string | null
}

export interface ConcertWithArtist extends Concert {
  artist_name: string
}

export interface GlobalRecentItem {
  identifier: string
  title: string
  date: string | null
  creator: string | null
  monitored: boolean
}

export interface DashboardData {
  artist_count: number
  status_counts: Record<string, number>
  recent_concerts: ConcertWithArtist[]
  artists: Artist[]
  recent_global: GlobalRecentItem[]
}

export interface SearchResultItem {
  identifier: string
  title: string
  date: string | null
}

export interface PreviewResult {
  query: string
  results: SearchResultItem[]
  error: string | null
}

export interface TrackItem {
  name: string
  size_bytes: number | null
}

export interface TrackListResult {
  source: "disk" | "preview"
  format: string | null
  tracks: TrackItem[]
  error: string | null
}

export interface DiscoverArtistItem {
  name: string
  count: number
  sample_identifier: string
  sample_title: string
  monitored: boolean
}

export interface DiscoverArtistsResult {
  query: string
  artists: DiscoverArtistItem[]
  error: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  getDashboard: () => request<DashboardData>("/dashboard"),

  getArtists: () => request<Artist[]>("/artists"),
  previewArtist: (name: string, query: string, auto_download: boolean) =>
    request<PreviewResult>("/artists/preview", {
      method: "POST",
      body: JSON.stringify({ name, query, auto_download }),
    }),
  createArtist: (name: string, query: string, auto_download: boolean) =>
    request<Artist>("/artists", {
      method: "POST",
      body: JSON.stringify({ name, query, auto_download }),
    }),
  getArtistDetail: (id: number) =>
    request<{ artist: Artist; concerts: Concert[] }>(`/artists/${id}`),
  checkArtist: (id: number) => request<Artist>(`/artists/${id}/check`, { method: "POST" }),
  toggleArtist: (id: number) => request<Artist>(`/artists/${id}/toggle`, { method: "POST" }),
  toggleAutoDownload: (id: number) =>
    request<Artist>(`/artists/${id}/toggle-auto-download`, { method: "POST" }),
  deleteArtist: (id: number) => request<{ ok: boolean }>(`/artists/${id}`, { method: "DELETE" }),

  getConcerts: (status?: string) =>
    request<ConcertWithArtist[]>(`/concerts${status ? `?status=${status}` : ""}`),
  getConcert: (id: number) => request<ConcertWithArtist>(`/concerts/${id}`),
  getConcertTracks: (id: number) => request<TrackListResult>(`/concerts/${id}/tracks`),
  retryConcert: (id: number) => request<Concert>(`/concerts/${id}/retry`, { method: "POST" }),
  downloadOne: (id: number) => request<Concert>(`/concerts/${id}/download`, { method: "POST" }),
  downloadSelected: (concertIds: number[]) =>
    request<{ count: number }>("/concerts/download-selected", {
      method: "POST",
      body: JSON.stringify({ concert_ids: concertIds }),
    }),
  downloadAllNew: (artistId?: number) =>
    request<{ count: number }>("/concerts/download-all-new", {
      method: "POST",
      body: JSON.stringify({ artist_id: artistId ?? null }),
    }),

  discoverArtists: (q: string) =>
    request<DiscoverArtistsResult>(`/discover/artists?q=${encodeURIComponent(q)}`),
}
