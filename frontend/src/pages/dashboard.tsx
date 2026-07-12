import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badge"
import { formatDateTime } from "@/lib/format"
import { api, type DashboardData } from "@/lib/api"

const STATUS_LABELS = ["new", "downloading", "downloaded", "failed"] as const

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  useEffect(() => {
    api.getDashboard().then(setData)
  }, [])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Monitored Artists" value={data.artist_count} />
        {STATUS_LABELS.map((s) => (
          <StatTile key={s} label={capitalize(s)} value={data.status_counts[s] ?? 0} />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Monitored Artists</h2>
        {data.artists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No artists monitored yet.{" "}
            <Link to="/artists/new" className="underline underline-offset-4">
              Add one
            </Link>
            .
          </p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Last Checked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.artists.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link to={`/artists/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell>{a.enabled ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(a.last_checked_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Recently Discovered</h2>
        {data.recent_concerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing discovered yet.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artist</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent_concerts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap">{c.artist_name}</TableCell>
                      <TableCell className="max-w-sm">
                        <Link
                          to={`/concerts/${c.id}`}
                          className="block truncate underline-offset-4 hover:underline"
                          title={c.title}
                        >
                          {c.title}
                        </Link>
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
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Recently Added on Archive.org</h2>
          <Link to="/discover" className="text-sm underline-offset-4 hover:underline">
            Browse artists
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Newest additions to the Live Music Archive, regardless of whether you're monitoring the artist.
        </p>
        {data.recent_global.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to show right now.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Artist</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent_global.map((item) => (
                    <TableRow key={item.identifier}>
                      <TableCell className="whitespace-nowrap">{item.creator ?? "-"}</TableCell>
                      <TableCell className="max-w-sm">
                        <a
                          href={`https://archive.org/details/${item.identifier}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate underline-offset-4 hover:underline"
                          title={item.title}
                        >
                          {item.title}
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.date ?? "-"}</TableCell>
                      <TableCell>
                        {item.monitored ? (
                          <Badge variant="outline">Monitored</Badge>
                        ) : item.creator ? (
                          <Link
                            to={`/artists/new?name=${encodeURIComponent(item.creator)}`}
                            className="text-sm underline-offset-4 hover:underline"
                          >
                            Monitor
                          </Link>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </CardHeader>
      <CardContent className="px-4 text-xs text-muted-foreground">{label}</CardContent>
    </Card>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
