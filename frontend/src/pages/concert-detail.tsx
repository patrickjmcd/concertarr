import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { formatDateTime } from "@/lib/format"
import { api, type ConcertWithArtist } from "@/lib/api"
import { toast } from "sonner"

export function ConcertDetail() {
  const { id } = useParams()
  const concertId = Number(id)
  const [concert, setConcert] = useState<ConcertWithArtist | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setConcert(await api.getConcert(concertId))
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{concert.title}</h1>
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
        <Row label="Collection">{concert.collection ?? "-"}</Row>
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
