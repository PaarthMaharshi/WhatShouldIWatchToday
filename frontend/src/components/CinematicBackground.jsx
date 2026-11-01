// Site-wide animated backdrop: dotted grid, three slowly drifting "stage
// light" glows, twinkling lens-flare sparkles and a faint film grain.
// Pure CSS/SVG (no WebGL), so it costs almost nothing; it freezes when the
// Animations toggle is off or the OS asks for reduced motion.

// x%, y%, size px, animation delay s
const SPARKLES = [
  [8, 18, 14, 0], [22, 64, 10, 1.2], [38, 12, 9, 2.1], [57, 78, 13, 0.6],
  [71, 30, 11, 1.7], [86, 58, 15, 2.6], [93, 14, 9, 0.9], [14, 88, 11, 3.1],
]

function Sparkle({ x, y, size, delay }) {
  return (
    <svg
      className="cinema-twinkle absolute text-accent"
      style={{ left: `${x}%`, top: `${y}%`, width: size, height: size, animationDelay: `${delay}s` }}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0Z" />
    </svg>
  )
}

export default function CinematicBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="cinema-glow a" />
      <div className="cinema-glow b" />
      <div className="cinema-glow c" />
      <div className="cinema-dots absolute inset-0" />
      {SPARKLES.map(([x, y, size, delay]) => (
        <Sparkle key={`${x}-${y}`} x={x} y={y} size={size} delay={delay} />
      ))}
      <div className="cinema-grain absolute inset-0" />
    </div>
  )
}
