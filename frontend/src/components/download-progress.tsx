import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { formatBytes } from "@/lib/format"
import { cn } from "@/lib/utils"
import { api, type ConcertWithArtist, type DownloadProgressItem } from "@/lib/api"
import { toast } from "sonner"

const POLL_INTERVAL_MS = 2000

export function DownloadProgress() {
  const [items, setItems] = useState<DownloadProgressItem[]>([])
  // Concerts seen as "downloading" on the last poll, keyed by id -- when one
  // drops out of that set, the download just concluded (success or failure).
  const trackedRef = useRef<Map<number, ConcertWithArtist>>(new Map())

  useEffect(() => {
    let cancelled = false

    async function notifyCompletion(id: number, prev: ConcertWithArtist) {
      try {
        const concert = await api.getConcert(id)
        const label = `${prev.artist_name} — ${prev.title}`
        if (concert.status === "downloaded") {
          toast.success(`Downloaded: ${label}`)
        } else if (concert.status === "failed") {
          toast.error(`Failed: ${label}${concert.error ? ` — ${concert.error}` : ""}`)
        }
      } catch {
        // best-effort notification; nothing actionable if this lookup fails
      }
    }

    async function poll() {
      try {
        const [progress, downloading] = await Promise.all([
          api.getActiveDownloads(),
          api.getConcerts("downloading"),
        ])
        if (cancelled) return
        setItems(progress)

        const tracked = trackedRef.current
        const stillDownloading = new Set(downloading.map((c) => c.id))
        for (const [id, prev] of tracked) {
          if (!stillDownloading.has(id)) {
            void notifyCompletion(id, prev)
          }
        }
        trackedRef.current = new Map(downloading.map((c) => [c.id, c]))
      } catch {
        // transient poll failure -- keep showing the last known state
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-40 w-72">
      <Card size="sm" className="shadow-lg">
        <CardHeader className="flex-row items-center gap-2">
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          <span className="text-xs font-medium">
            Downloading {items.length} show{items.length === 1 ? "" : "s"}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => {
            const pct =
              item.bytes_total && item.bytes_total > 0
                ? Math.min(100, Math.round((item.bytes_done / item.bytes_total) * 100))
                : null
            return (
              <Link key={item.concert_id} to={`/concerts/${item.concert_id}`} className="block">
                <p className="truncate text-xs font-medium hover:underline" title={item.title}>
                  {item.artist_name} — {item.title}
                </p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full bg-primary",
                      pct === null ? "w-1/3 animate-pulse" : "transition-[width]"
                    )}
                    style={pct !== null ? { width: `${pct}%` } : undefined}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatBytes(item.bytes_done)}
                  {item.bytes_total ? ` / ${formatBytes(item.bytes_total)}` : ""}
                  {pct !== null ? ` · ${pct}%` : ""}
                </p>
              </Link>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
