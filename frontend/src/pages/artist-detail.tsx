import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusBadge } from "@/components/status-badge"
import { ConcertFlag } from "@/components/concert-flag"
import { formatDateTime } from "@/lib/format"
import { api, type Artist, type Concert } from "@/lib/api"
import { toast } from "sonner"

export function ArtistDetail() {
  const { id } = useParams()
  const artistId = Number(id)
  const navigate = useNavigate()

  const [artist, setArtist] = useState<Artist | null>(null)
  const [concerts, setConcerts] = useState<Concert[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    const detail = await api.getArtistDetail(artistId)
    setArtist(detail.artist)
    setConcerts(detail.concerts)
    setSelected(new Set())
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistId])

  async function handleCheckNow() {
    setBusy(true)
    try {
      await api.checkArtist(artistId)
      await load()
      toast.success("Checked for new shows")
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleEnabled() {
    const updated = await api.toggleArtist(artistId)
    setArtist(updated)
  }

  async function handleToggleAutoDownload() {
    const updated = await api.toggleAutoDownload(artistId)
    setArtist(updated)
  }

  async function handleDelete() {
    await api.deleteArtist(artistId)
    navigate("/artists")
  }

  async function handleDownloadSelected() {
    if (selected.size === 0) return
    setBusy(true)
    try {
      const { count } = await api.downloadSelected(Array.from(selected))
      toast.success(`Queued ${count} download(s)`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleDownloadAllNew() {
    setBusy(true)
    try {
      const { count } = await api.downloadAllNew(artistId)
      toast.success(`Queued ${count} download(s)`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!artist || !concerts) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  const hasNew = concerts.some((c) => c.status === "new")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{artist.name}</h1>
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={handleCheckNow} disabled={busy}>
            Check Now
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={artist.enabled} onCheckedChange={handleToggleEnabled} />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={artist.auto_download} onCheckedChange={handleToggleAutoDownload} />
            Auto-download
          </label>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <p className="font-mono text-xs text-muted-foreground">{artist.query}</p>
        <p className="text-muted-foreground">Last checked: {formatDateTime(artist.last_checked_at)}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Concerts</h2>
        {concerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing discovered yet for this artist.</p>
        ) : (
          <>
            {hasNew && (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleDownloadAllNew} disabled={busy}>
                  Download All New
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadSelected}
                  disabled={busy || selected.size === 0}
                >
                  Download Selected ({selected.size})
                </Button>
              </div>
            )}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {concerts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          {c.status === "new" && (
                            <Checkbox
                              checked={selected.has(c.id)}
                              onCheckedChange={(checked) => {
                                setSelected((prev) => {
                                  const next = new Set(prev)
                                  if (checked) next.add(c.id)
                                  else next.delete(c.id)
                                  return next
                                })
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <div className="flex items-center">
                            <Link
                              to={`/concerts/${c.id}`}
                              className="truncate underline-offset-4 hover:underline"
                              title={c.title}
                            >
                              {c.title}
                            </Link>
                            <ConcertFlag likelyConcert={c.likely_concert} />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.show_date ?? "-"}</TableCell>
                        <TableCell>
                          <StatusBadge status={c.status} />
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {artist.name}?</DialogTitle>
            <DialogDescription>
              This removes the artist and its discovered-concert history. Already-downloaded files on
              disk are not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
