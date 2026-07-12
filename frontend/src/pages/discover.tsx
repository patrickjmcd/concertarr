import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ConcertFlag } from "@/components/concert-flag"
import { api, type DiscoverArtistItem } from "@/lib/api"

export function Discover() {
  const [term, setTerm] = useState("")
  const [artists, setArtists] = useState<DiscoverArtistItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function runSearch(q: string) {
    setLoading(true)
    try {
      const result = await api.discoverArtists(q)
      setArtists(result.artists)
      setError(result.error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runSearch("")
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => runSearch(term), 400)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Browse Artists</h1>
      <p className="text-sm text-muted-foreground">
        Discover bands with live recordings on archive.org. Leave the search blank to see artists
        recently active in the Live Music Archive, or search by name.
      </p>

      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search for an artist…"
        className="max-w-md"
      />

      {error && <p className="text-sm text-destructive">Search failed: {error}</p>}

      {loading && !artists ? (
        <Skeleton className="h-64 w-full" />
      ) : artists && artists.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching artists found.</p>
      ) : artists ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artist</TableHead>
                  <TableHead>Sample Show</TableHead>
                  <TableHead className="text-right">Shows Seen</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artists.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="max-w-40 truncate font-medium" title={a.name}>
                      {a.name}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <div className="flex items-center">
                        <a
                          href={`https://archive.org/details/${a.sample_identifier}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate underline-offset-4 hover:underline"
                          title={a.sample_title}
                        >
                          {a.sample_title}
                        </a>
                        <ConcertFlag likelyConcert={a.likely_concert} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                      {a.count}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {a.monitored ? (
                        <Badge variant="outline">Monitored</Badge>
                      ) : (
                        <Button asChild size="sm" variant="outline">
                          <Link to={`/artists/new?name=${encodeURIComponent(a.name)}`}>Monitor</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
