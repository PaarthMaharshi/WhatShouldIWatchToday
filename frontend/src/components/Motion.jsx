// Thin wrappers around the React Bits components so every animation obeys the
// site-wide Animations toggle (and, inside the components, the OS
// reduced-motion setting). With motion off they render plain elements.
import { useApp } from '../context'
import BlurText from './reactbits/BlurText'
import CountUp from './reactbits/CountUp'
import ShinyText from './reactbits/ShinyText'
import SpotlightCard from './reactbits/SpotlightCard'
import StarBorder from './reactbits/StarBorder'

/** Heading whose words blur in once it scrolls into view. */
export function RevealText({ as: Tag = 'h1', text, className = '', delay = 90 }) {
  const { motionOn } = useApp()
  if (!motionOn) return <Tag className={className}>{text}</Tag>
  return (
    <BlurText as={Tag} key={text} text={text} className={className} delay={delay}
      animateBy="words" direction="top" stepDuration={0.3} />
  )
}

/** Small label with a moving sheen. */
export function Shine({ children, className = '' }) {
  const { motionOn } = useApp()
  return (
    <ShinyText className={className} color="currentColor" shineColor="#ffffff" speed={3}
      disabled={!motionOn}>
      {children}
    </ShinyText>
  )
}

/** Number that counts up when it scrolls into view. */
export function Counter({ to, decimals = 0, suffix = '', separator = ',', className = '' }) {
  const { motionOn } = useApp()
  if (!motionOn) {
    const fixed = Number(to).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    return <span className={className}>{fixed}{suffix}</span>
  }
  return <CountUp to={to} decimals={decimals} suffix={suffix} separator={separator} duration={1.6} className={className} />
}

/** Card with a cursor-following spotlight (static card when motion is off). */
export function Spotlight({ children, className = '', ...rest }) {
  const { motionOn, theme } = useApp()
  if (!motionOn) {
    return <div className={`relative rounded-3xl border border-line bg-surface ${className}`} {...rest}>{children}</div>
  }
  return (
    <SpotlightCard className={className} theme={theme} spotlightColor="rgba(232, 64, 58, 0.22)"
      intensity={0.2} {...rest}>
      {children}
    </SpotlightCard>
  )
}

/** Call-to-action whose border has a travelling star (plain button when off). */
export function StarButton({ children, className = '', as = 'button', fill = '#E8403A', ink = '#ffffff', ...rest }) {
  const { motionOn, theme } = useApp()
  if (!motionOn) {
    const Tag = as
    return (
      <Tag className={`inline-flex items-center justify-center rounded-full px-6 py-3.5 font-medium ${className}`}
        style={{ background: fill, color: ink }} {...rest}>
        {children}
      </Tag>
    )
  }
  return (
    <StarBorder as={as} theme={theme} color="#ffffff" trailColor="#ffd6d3" radius={999} duration={5}
      glow={0.8} backgroundColor={fill} textColor={ink} className={className} {...rest}>
      {children}
    </StarBorder>
  )
}
