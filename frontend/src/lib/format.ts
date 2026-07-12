export function formatDateTime(iso: string | null): string {
  if (!iso) return "never"
  const d = new Date(iso.endsWith("Z") ? iso : `${iso}Z`)
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
