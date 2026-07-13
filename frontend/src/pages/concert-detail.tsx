import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/status-badge"
import { ConcertFlag } from "@/components/concert-flag"
import { TrackPlayer } from "@/components/track-player"
import { formatBytes, formatDateTime, formatTrackLength } from "@/lib/format"
import { cn } from "@/lib/utils"
import { api, type ConcertWithArtist, type TrackListResult } from "@/lib/api"
import { toast } from "sonner"

export function ConcertDetail() {
  const { id } = useParams()
  const concertId = Number(id)
  const [concert, setConcert] = useState<ConcertWithArtist | null>(null)
  const [tracks, setTracks] = useState<TrackListResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  async function load() {
    const detail = await api.getConcert(concertId)
    setConcert(detail)
    setTracks(null)
    setPlayingIndex(null)
    api.getConcertTracks(concertId).then(setTracks)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concertId])

  async function handleDownloadNow() {
    setBusy(true)
    try {
      await api.downloadOne(concertId)
      toast.success("Download queued")
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleRetry() {
    setBusy(true)
    try {
      await api.retryConcert(concertId)
      toast.success("Retry queued")
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!concert) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-96" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", playingIndex !== null && "pb-20")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center text-2xl font-semibold tracking-tight">
          {concert.title}
          <ConcertFlag likelyConcert={concert.likely_concert} />
        </h1>
        {concert.status === "new" && (
          <Button onClick={handleDownloadNow} disabled={busy}>
            Download Now
          </Button>
        )}
        {concert.status === "failed" && (
          <Button variant="outline" onClick={handleRetry} disabled={busy}>
            Retry Download
          </Button>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        <Row label="Artist">
          <Link to={`/artists/${concert.artist_id}`} className="underline-offset-4 hover:underline">
            {concert.artist_name}
          </Link>
        </Row>
        <Row label="Status">
          <StatusBadge status={concert.status} />
        </Row>
        <Row label="Date">{concert.show_date ?? "unknown"}</Row>
        <Row label="Source">{concert.source ?? "-"}</Row>
        <Row label="Identifier">
          <a
            href={`https://archive.org/details/${concert.identifier}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {concert.identifier}
          </a>
        </Row>
        {concert.format_used && <Row label="Format">{concert.format_used}</Row>}
        {concert.download_path && (
          <Row label="Path">
            <span className="font-mono text-xs">{concert.download_path}</span>
          </Row>
        )}
        {concert.error && (
          <Row label="Error">
            <span className="text-destructive">{concert.error}</span>
          </Row>
        )}
        <Row label="Discovered">{formatDateTime(concert.discovered_at)}</Row>
        {concert.downloaded_at && <Row label="Downloaded">{formatDateTime(concert.downloaded_at)}</Row>}
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Tracks{tracks?.format ? ` (${tracks.format})` : ""}
        </h2>
        {!tracks ? (
          <Skeleton className="h-40 w-full" />
        ) : tracks.error ? (
          <p className="text-sm text-muted-foreground">Couldn't load tracks: {tracks.error}</p>
        ) : tracks.tracks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracks found.</p>
        ) : (
          <>
            {tracks.source === "preview" && (
              <p className="text-xs text-muted-foreground">
                Preview of what would be downloaded (not yet fetched).
              </p>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right">Length</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tracks.tracks.map((t, i) => (
                      <TableRow key={t.name} className={cn(playingIndex === i && "bg-muted/50")}>
                        <TableCell>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={!t.stream_url}
                            onClick={() => setPlayingIndex(i)}
                          >
                            <Play />
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{t.track_number ?? "-"}</TableCell>
                        <TableCell
                          title={t.name}
                          className={cn(playingIndex === i && "font-medium text-foreground")}
                        >
                          {t.title ?? t.name}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                          {formatTrackLength(t.length)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                          {formatBytes(t.size_bytes)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      {tracks && tracks.tracks.length > 0 && (
        <TrackPlayer tracks={tracks.tracks} currentIndex={playingIndex} onIndexChange={setPlayingIndex} />
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
