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

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function formatTrackLength(length: string | null): string {
  if (!length) return "-"
  // archive.org's file "length" is usually raw seconds (often with a
  // fractional part, e.g. "245.32"), but is occasionally pre-formatted
  // as "m:ss" already -- only convert the former.
  if (length.includes(":")) return length
  const seconds = Number(length)
  return Number.isFinite(seconds) ? formatDuration(seconds) : length
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}
