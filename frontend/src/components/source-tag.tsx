export function SourceTag({ source }: { source: string | null }) {
  if (!source) return null
  return <span className="ml-1.5 shrink-0 text-xs text-muted-foreground">via {source}</span>
}
