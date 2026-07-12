import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  downloading: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  downloaded: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("border-transparent capitalize", STATUS_STYLES[status])}>
      {status}
    </Badge>
  )
}
