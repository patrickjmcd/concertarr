import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { Layout } from "@/components/layout"
import { AadamJacobs } from "@/pages/aadam-jacobs"
import { Artists } from "@/pages/artists"
import { ArtistNew } from "@/pages/artist-new"
import { ArtistDetail } from "@/pages/artist-detail"
import { Concerts } from "@/pages/concerts"
import { ConcertDetail } from "@/pages/concert-detail"
import { ShowDetail } from "@/pages/show-detail"
import { Discover } from "@/pages/discover"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/aadam-jacobs" replace />} />
          <Route path="/dashboard" element={<Navigate to="/aadam-jacobs" replace />} />
          <Route path="/aadam-jacobs" element={<AadamJacobs />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/artists/new" element={<ArtistNew />} />
          <Route path="/artists/:id" element={<ArtistDetail />} />
          <Route path="/concerts" element={<Concerts />} />
          <Route path="/concerts/:id" element={<ConcertDetail />} />
          <Route path="/shows/:identifier" element={<ShowDetail />} />
          <Route path="/discover" element={<Discover />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
