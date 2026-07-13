import { NavLink, Outlet } from "react-router-dom"
import { DownloadProgress } from "@/components/download-progress"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/aadam-jacobs", label: "Aadam Jacobs" },
  { to: "/artists", label: "Artists" },
  { to: "/concerts", label: "Library" },
  { to: "/discover", label: "Discover" },
]

export function Layout() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <nav className="flex items-center gap-6 border-b px-8 py-4">
        <NavLink to="/dashboard" className="font-semibold tracking-tight">
          concertarr
        </NavLink>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "text-sm text-muted-foreground transition-colors hover:text-foreground",
                isActive && "font-medium text-foreground"
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="mx-auto max-w-4xl px-8 py-8">
        <Outlet />
      </main>
      <DownloadProgress />
    </div>
  )
}
