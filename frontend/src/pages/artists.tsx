import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime } from "@/lib/format"
import { api, type Artist } from "@/lib/api"

export function Artists() {
  const [artists, setArtists] = useState<Artist[] | null>(null)

  useEffect(() => {
    api.getArtists().then(setArtists)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Artists</h1>
        <Button asChild>
          <Link to="/artists/new">+ Add Artist</Link>
        </Button>
      </div>

      {!artists ? (
        <Skeleton className="h-64 w-full" />
      ) : artists.length === 0 ? (
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
                  <TableHead>Query</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Auto-download</TableHead>
                  <TableHead>Last Checked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artists.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link to={`/artists/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                        {a.name}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      {a.query}
                    </TableCell>
                    <TableCell>{a.enabled ? "Yes" : "No"}</TableCell>
                    <TableCell>{a.auto_download ? "Yes" : "No"}</TableCell>
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
    </div>
  )
}
