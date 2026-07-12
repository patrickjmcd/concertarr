import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConcertFlag } from "@/components/concert-flag"
import { SourceTag } from "@/components/source-tag"
import { api, type SearchResultItem } from "@/lib/api"
import { toast } from "sonner"

export function ArtistNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefillName = searchParams.get("name") ?? ""

  const [name, setName] = useState(prefillName)
  const [query, setQuery] = useState("")
  const [autoDownload, setAutoDownload] = useState(true)
  const [results, setResults] = useState<SearchResultItem[] | null>(null)
  const [totalFound, setTotalFound] = useState(0)
  const [effectiveQuery, setEffectiveQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function runPreview(nameValue: string, queryValue: string, autoDownloadValue: boolean) {
    setLoading(true)
    setError(null)
    try {
      const preview = await api.previewArtist(nameValue, queryValue, autoDownloadValue)
      setResults(preview.results)
      setTotalFound(preview.total_found)
      setEffectiveQuery(preview.query)
      setError(preview.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (prefillName) {
      runPreview(prefillName, "", true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillName])

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault()
    await runPreview(name, query, autoDownload)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const artist = await api.createArtist(name, effectiveQuery, autoDownload)
      toast.success(`Now monitoring ${artist.name}`)
      navigate(`/artists/${artist.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add Artist</h1>

      <form onSubmit={handlePreview} className="max-w-lg space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Artist / Band Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="query">Archive.org query (optional override)</Label>
          <Input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='creator:("Name") AND mediatype:(audio)'
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="auto_download"
            checked={autoDownload}
            onCheckedChange={(checked) => setAutoDownload(checked === true)}
          />
          <Label htmlFor="auto_download" className="font-normal">
            Auto-download newly discovered shows
          </Label>
        </div>
        <Button type="submit" disabled={loading || !name}>
          {loading ? "Searching…" : "Preview Matches"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">Search failed: {error}</p>}

      {results !== null && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">
              {totalFound > results.length
                ? `Showing ${results.length} of ${totalFound} matches`
                : `${results.length} match(es)`}
            </h2>
            {totalFound > results.length && (
              <p className="text-xs text-muted-foreground">
                Saving will backfill the full back catalog (up to 500 shows), not just what's shown here.
              </p>
            )}
          </div>
          {results.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Identifier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r) => (
                      <TableRow key={r.identifier}>
                        <TableCell className="flex items-center">
                          {r.title}
                          <ConcertFlag likelyConcert={r.likely_concert} />
                          <SourceTag source={r.source} />
                        </TableCell>
                        <TableCell>{(r.date ?? "").slice(0, 10)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.identifier}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              No matches for this query. Try adjusting the query above.
            </p>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save & Monitor This Artist"}
          </Button>
        </div>
      )}
    </div>
  )
}
