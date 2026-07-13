import { useEffect, useRef, useState } from "react"
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/format"
import type { TrackItem } from "@/lib/api"

interface TrackPlayerProps {
  tracks: TrackItem[]
  currentIndex: number | null
  onIndexChange: (index: number | null) => void
}

export function TrackPlayer({ tracks, currentIndex, onIndexChange }: TrackPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const track = currentIndex !== null ? tracks[currentIndex] : null

  useEffect(() => {
    setCurrentTime(0)
    setDuration(0)
    if (track) {
      audioRef.current?.play().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  if (!track) return null

  function step(delta: number) {
    if (currentIndex === null) return
    const next = currentIndex + delta
    if (next >= 0 && next < tracks.length) {
      onIndexChange(next)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background">
      <audio
        ref={audioRef}
        src={track.stream_url ?? undefined}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => step(1)}
      />
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-8 py-3">
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon-sm" variant="ghost" disabled={currentIndex === 0} onClick={() => step(-1)}>
            <SkipBack />
          </Button>
          <Button
            size="icon-sm"
            onClick={() => (isPlaying ? audioRef.current?.pause() : audioRef.current?.play())}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={currentIndex === tracks.length - 1}
            onClick={() => step(1)}
          >
            <SkipForward />
          </Button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{track.title ?? track.name}</p>
          <div className="flex items-center gap-2">
            <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {formatDuration(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => {
                const t = Number(e.target.value)
                if (audioRef.current) audioRef.current.currentTime = t
                setCurrentTime(t)
              }}
              className="h-1 w-full accent-primary"
            />
            <span className="w-9 shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatDuration(duration)}
            </span>
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={() => onIndexChange(null)}>
          <X />
        </Button>
      </div>
    </div>
  )
}
