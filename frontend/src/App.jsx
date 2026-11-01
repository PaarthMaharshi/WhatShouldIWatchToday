import { useEffect, useRef, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Footer from './components/Footer'
import { useVelvet } from './components/Motion'
import Navbar from './components/Navbar'
import ClickSpark from './components/reactbits/ClickSpark'
import { useApp } from './context'
import Browse from './pages/Browse'
import ComingSoon from './pages/ComingSoon'
import ForYou from './pages/ForYou'
import Forum from './pages/Forum'
import ForumPost from './pages/ForumPost'
import Home from './pages/Home'
import Mood from './pages/Mood'
import MovieDetail from './pages/MovieDetail'
import UnderTheHood from './pages/UnderTheHood'
import Welcome from './pages/Welcome'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

const EASE = [0.76, 0, 0.24, 1]

/** Red velvet curtain that lifts away on every page change (never on first load). */
function Curtain() {
  const { pathname } = useLocation()
  const { motionOn } = useApp()
  const prev = useRef(pathname)
  const [run, setRun] = useState(0)        // increments only when the path really changes
  useEffect(() => {
    if (prev.current !== pathname) {
      prev.current = pathname
      setRun((r) => r + 1)
    }
  }, [pathname])
  if (!motionOn || run === 0) return null
  return (
    <motion.div
      key={run}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60] origin-top"
      style={{
        // velvet folds: soft vertical shading over the accent colour
        background:
          'repeating-linear-gradient(90deg, rgb(0 0 0 / 0.22) 0, rgb(0 0 0 / 0) 28px, rgb(255 255 255 / 0.06) 44px, rgb(0 0 0 / 0.22) 72px), rgb(var(--accent))',
      }}
      initial={{ scaleY: 1 }}
      animate={{ scaleY: 0 }}
      transition={{ duration: 0.75, ease: EASE, delay: 0.05 }}
    />
  )
}

const ROUTES = (
  <>
    <Route path="/" element={<Home />} />
    <Route path="/welcome" element={<Welcome />} />
    <Route path="/browse" element={<Browse />} />
    <Route path="/for-you" element={<ForYou />} />
    <Route path="/mood" element={<Mood />} />
    <Route path="/forum" element={<Forum />} />
    <Route path="/forum/:id" element={<ForumPost />} />
    <Route path="/movie/:id" element={<MovieDetail />} />
    <Route path="/under-the-hood" element={<UnderTheHood />} />
    <Route path="*" element={<ComingSoon title="Page not found" />} />
  </>
)

export default function App() {
  const { motionOn } = useApp()
  const location = useLocation()
  const velvet = useVelvet()
  return (
    <ClickSpark sparkColor={velvet.accent} sparkCount={10} sparkRadius={26} disabled={!motionOn}
      className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Navbar />
      <main id="main" className="flex-1 overflow-x-clip">
        {motionOn ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
            >
              <Routes location={location}>{ROUTES}</Routes>
            </motion.div>
          </AnimatePresence>
        ) : (
          <Routes location={location}>{ROUTES}</Routes>
        )}
      </main>
      <Curtain />
      <Footer />
    </ClickSpark>
  )
}
