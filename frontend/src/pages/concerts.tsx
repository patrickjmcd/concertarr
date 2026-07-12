import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/status-badge"
import { ConcertFlag } from "@/components/concert-flag"
import { api, type ConcertWithArtist } from "@/lib/api"
import { toast } from "sonner"

const STATUSES = ["new", "downloading", "downloaded", "failed"]

export function Concerts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get("status") ?? "all"

  const [concerts, setConcerts] = useState<ConcertWithArtist[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)

  async function load() {
    const data = await api.getConcerts(status === "all" ? undefined : status)
    setConcerts(data)
    setSelected(new Set())
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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
      const { count } = await api.downloadAllNew()
      toast.success(`Queued ${count} download(s)`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const hasNew = (concerts ?? []).some((c) => c.status === "new")

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Library</h1>

      <Tabs
        value={status}
        onValueChange={(v) => setSearchParams(v === "all" ? {} : { status: v })}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!concerts ? (
        <Skeleton className="h-64 w-full" />
      ) : concerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No concerts found.</p>
      ) : (
        <>
          {hasNew && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleDownloadAllNew} disabled={busy}>
                Download All New
              </Button>
              <Button variant="outline" onClick={handleDownloadSelected} disabled={busy || selected.size === 0}>
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
                    <TableHead>Artist</TableHead>
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
                      <TableCell className="whitespace-nowrap">{c.artist_name}</TableCell>
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
    </div>
  )
}
