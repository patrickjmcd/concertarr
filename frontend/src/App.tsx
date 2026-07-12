import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { Layout } from "@/components/layout"
import { Dashboard } from "@/pages/dashboard"
import { Artists } from "@/pages/artists"
import { ArtistNew } from "@/pages/artist-new"
import { ArtistDetail } from "@/pages/artist-detail"
import { Concerts } from "@/pages/concerts"
import { ConcertDetail } from "@/pages/concert-detail"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/artists/new" element={<ArtistNew />} />
          <Route path="/artists/:id" element={<ArtistDetail />} />
          <Route path="/concerts" element={<Concerts />} />
          <Route path="/concerts/:id" element={<ConcertDetail />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
