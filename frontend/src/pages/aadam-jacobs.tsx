import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ExternalLink, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { ConcertFlag } from "@/components/concert-flag"
import { SourceTag } from "@/components/source-tag"
import { TrackPlayer } from "@/components/track-player"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"
import { api, type AJShowItem, type AJSort, type TrackItem } from "@/lib/api"
import { toast } from "sonner"

const ROWS_PER_PAGE = 30

const SORT_OPTIONS: { value: AJSort; label: string }[] = [
  { value: "recent", label: "Recently Added" },
  { value: "date", label: "Show Date" },
  { value: "popularity", label: "Popularity" },
]

export function AadamJacobs() {
  const [term, setTerm] = useState("")
  const [sort, setSort] = useState<AJSort>("recent")
  const [items, setItems] = useState<AJShowItem[] | null>(null)
  const [totalFound, setTotalFound] = useState(0)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pendingIdentifiers, setPendingIdentifiers] = useState<Set<string>>(new Set())
  const [queuedIdentifiers, setQueuedIdentifiers] = useState<Set<string>>(new Set())

  const [playingIdentifier, setPlayingIdentifier] = useState<string | null>(null)
  const [playingTracks, setPlayingTracks] = useState<TrackItem[] | null>(null)
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  async function runSearch(q: string, sortValue: AJSort) {
    setLoading(true)
    setPage(1)
    try {
      const result = await api.getAadamJacobsShows(q, 1, ROWS_PER_PAGE, sortValue)
      setItems(result.items)
      setTotalFound(result.total_found)
      setError(result.error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const result = await api.getAadamJacobsShows(term, nextPage, ROWS_PER_PAGE, sort)
      setItems((prev) => [...(prev ?? []), ...result.items])
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    runSearch("", sort)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => runSearch(term, sort), 400)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  function handleSortChange(value: AJSort) {
    setSort(value)
    runSearch(term, value)
  }

  function markPending(identifier: string, pending: boolean) {
    setPendingIdentifiers((prev) => {
      const next = new Set(prev)
      if (pending) next.add(identifier)
      else next.delete(identifier)
      return next
    })
  }

  async function handlePlay(item: AJShowItem) {
    setPlayingIdentifier(item.identifier)
    setPlayingTracks(null)
    setPlayingIndex(null)
    markPending(item.identifier, true)
    try {
      const result = await api.getArchiveTracks(item.identifier)
      if (result.tracks.length === 0) {
        toast.error(result.error ?? "No playable tracks found")
        setPlayingIdentifier(null)
        return
      }
      setPlayingTracks(result.tracks)
      setPlayingIndex(0)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setPlayingIdentifier(null)
    } finally {
      markPending(item.identifier, false)
    }
  }

  async function handleDownload(item: AJShowItem) {
    markPending(item.identifier, true)
    try {
      const concert = await api.downloadAadamJacobsShow(item)
      toast.success("Download queued")
      setQueuedIdentifiers((prev) => new Set(prev).add(item.identifier))
      setItems(
        (prev) =>
          prev?.map((i) =>
            i.identifier === item.identifier
              ? { ...i, concert_id: concert.id, status: concert.status }
              : i
          ) ?? prev
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      markPending(item.identifier, false)
    }
  }

  return (
    <div className={cn("space-y-6", playingIndex !== null && "pb-20")}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Aadam Jacobs Collection</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Live recordings taped by Aadam Jacobs across the Chicago music scene from the 1980s
          through the 2000s — Lounge Ax, Empty Bottle, The Hideout, and more. Play a show right
          from here, or download it and monitor the artist for future shows.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search for an artist…"
          className="max-w-md"
        />
        <div className="flex items-center gap-1">
          {SORT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={sort === opt.value ? "secondary" : "ghost"}
              onClick={() => handleSortChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">Search failed: {error}</p>}

      {loading && !items ? (
        <Skeleton className="h-64 w-full" />
      ) : items && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching shows found.</p>
      ) : items ? (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Artist</TableHead>
                    <TableHead>Show</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const isPending = pendingIdentifiers.has(item.identifier)
                    const isPlaying = playingIdentifier === item.identifier && playingIndex !== null
                    const status = queuedIdentifiers.has(item.identifier) ? "downloading" : item.status
                    const showDownloadButton = !item.concert_id || status === "new" || status === null
                    return (
                      <TableRow key={item.identifier} className={cn(isPlaying && "bg-muted/50")}>
                        <TableCell>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => handlePlay(item)}
                          >
                            {isPending && playingIdentifier === item.identifier ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Play />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="max-w-32 truncate font-medium" title={item.creator ?? ""}>
                          {item.creator ?? "-"}
                        </TableCell>
                        <TableCell className="max-w-72">
                          <div className="flex items-center">
                            <Link
                              to={
                                item.concert_id
                                  ? `/concerts/${item.concert_id}`
                                  : `/shows/${item.identifier}`
                              }
                              className="truncate underline-offset-4 hover:underline"
                              title={item.title}
                            >
                              {item.title}
                            </Link>
                            <a
                              href={`https://archive.org/details/${item.identifier}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View on archive.org"
                              className="ml-1.5 inline-flex shrink-0 items-center text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                            <ConcertFlag likelyConcert={item.likely_concert} />
                            <SourceTag source={item.source} />
                          </div>
                          {item.venue && (
                            <div className="truncate text-xs text-muted-foreground">{item.venue}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                          <div>{item.date ?? "-"}</div>
                          {item.downloads !== null && (
                            <div className="text-xs">{formatCount(item.downloads)} plays</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                            {!item.monitored && item.creator && (
                              <Link
                                to={`/artists/new?name=${encodeURIComponent(item.creator)}`}
                                className="text-xs underline-offset-4 hover:underline"
                              >
                                Monitor
                              </Link>
                            )}
                            {showDownloadButton ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending || !item.creator}
                                onClick={() => handleDownload(item)}
                              >
                                Download
                              </Button>
                            ) : (
                              <Link to={`/concerts/${item.concert_id}`}>
                                <StatusBadge status={status!} />
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {items.length} of {totalFound.toLocaleString()} shows
            </p>
            {items.length < totalFound && (
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        </>
      ) : null}

      {playingTracks && (
        <TrackPlayer tracks={playingTracks} currentIndex={playingIndex} onIndexChange={setPlayingIndex} />
      )}
    </div>
  )
}
