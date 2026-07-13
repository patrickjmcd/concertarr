import { useEffect, useState } from "react"
import { Link, Navigate, useParams } from "react-router-dom"
import { ExternalLink, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConcertFlag } from "@/components/concert-flag"
import { SourceTag } from "@/components/source-tag"
import { TrackPlayer } from "@/components/track-player"
import { formatBytes, formatTrackLength } from "@/lib/format"
import { cn } from "@/lib/utils"
import { api, type AJShowItem, type TrackListResult } from "@/lib/api"
import { toast } from "sonner"

export function ShowDetail() {
  const { identifier } = useParams()
  const [show, setShow] = useState<AJShowItem | null>(null)
  const [tracks, setTracks] = useState<TrackListResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  async function load() {
    if (!identifier) return
    const detail = await api.getArchiveShow(identifier)
    setShow(detail)
    setTracks(null)
    setPlayingIndex(null)
    api.getArchiveTracks(identifier).then(setTracks)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier])

  async function handleDownload() {
    if (!show) return
    setBusy(true)
    try {
      await api.downloadAadamJacobsShow(show)
      toast.success("Download queued")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (!identifier) return <Navigate to="/aadam-jacobs" replace />

  // A tracked show already has a full Concert-backed page with richer detail
  // (download path, format, error state, retry) -- prefer that over this
  // lighter generic view once it exists.
  if (show?.concert_id) {
    return <Navigate to={`/concerts/${show.concert_id}`} replace />
  }

  if (!show) {
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
          {show.title}
          <ConcertFlag likelyConcert={show.likely_concert} />
        </h1>
        <div className="flex items-center gap-2">
          {!show.monitored && show.creator && (
            <Button asChild variant="outline">
              <Link to={`/artists/new?name=${encodeURIComponent(show.creator)}`}>Monitor Artist</Link>
            </Button>
          )}
          <Button onClick={handleDownload} disabled={busy || !show.creator}>
            {busy ? "Queuing…" : "Download"}
          </Button>
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <Row label="Artist">
          <span className="flex items-center gap-2">
            {show.creator ?? "unknown"}
            {show.monitored && <Badge variant="outline">Monitored</Badge>}
          </span>
        </Row>
        <Row label="Date">{show.date ?? "unknown"}</Row>
        {show.venue && <Row label="Venue">{show.venue}</Row>}
        <Row label="Source">
          <SourceTag source={show.source} />
          {!show.source && "-"}
        </Row>
        <Row label="Identifier">
          <a
            href={`https://archive.org/details/${show.identifier}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            {show.identifier}
            <ExternalLink className="size-3.5" />
          </a>
        </Row>
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tracks{tracks?.format ? ` (${tracks.format})` : ""}</h2>
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
                Streaming from archive.org — download this show to play from a local copy instead.
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
