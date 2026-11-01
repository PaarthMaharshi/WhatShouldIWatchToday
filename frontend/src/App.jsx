import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Welcome from './pages/Welcome'
import ComingSoon from './pages/ComingSoon'
import Browse from './pages/Browse'
import ForYou from './pages/ForYou'
import MovieDetail from './pages/MovieDetail'
import UnderTheHood from './pages/UnderTheHood'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main id="main" className="flex-1 overflow-x-clip">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/for-you" element={<ForYou />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="/under-the-hood" element={<UnderTheHood />} />
          <Route path="*" element={<ComingSoon title="Page not found" />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
