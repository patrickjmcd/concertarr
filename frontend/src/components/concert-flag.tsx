import { TriangleAlert } from "lucide-react"

export function ConcertFlag({ likelyConcert }: { likelyConcert: boolean }) {
  if (likelyConcert) return null
  return (
    <span
      title="Doesn't look like a live recording based on its title — might be a studio release, compilation, remaster, etc."
      className="ml-1.5 inline-flex shrink-0 items-center text-amber-500"
    >
      <TriangleAlert className="size-3.5" />
    </span>
  )
}
