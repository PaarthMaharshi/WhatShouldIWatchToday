// Thin wrappers around the React Bits components so every animation obeys the
// site-wide Animations toggle (and, inside the components, the OS
// reduced-motion setting). With motion off they render plain elements.
import { useApp } from '../context'
import AnimatedContent from './reactbits/AnimatedContent'
import BlurText from './reactbits/BlurText'
import CountUp from './reactbits/CountUp'
import ScrollFloat from './reactbits/ScrollFloat'
import ScrollVelocity from './reactbits/ScrollVelocity'
import SpotlightCard from './reactbits/SpotlightCard'
import StarBorder from './reactbits/StarBorder'

/** Red velvet palette for components that need concrete colours. */
export const VELVET = {
  light: { accent: '#A41626', cream: '#F6EFE5', blush: '#E8C4BA' },
  dark: { accent: '#D62C3E', cream: '#F6ECE0', blush: '#5C1E28' },
}
export const useVelvet = () => VELVET[useApp().theme] ?? VELVET.light

/** Heading whose words blur in once it scrolls into view. */
export function RevealText({ as: Tag = 'h1', text, className = '', delay = 90 }) {
  const { motionOn } = useApp()
  if (!motionOn) return <Tag className={className}>{text}</Tag>
  return (
    <BlurText as={Tag} key={text} text={text} className={className} delay={delay}
      animateBy="words" direction="top" stepDuration={0.3} />
  )
}

/** Section that slides and fades in as it scrolls into view (React Bits AnimatedContent). */
export function Reveal({ children, delay = 0, distance = 60, className = '' }) {
  const { motionOn } = useApp()
  if (!motionOn) return <div className={className}>{children}</div>
  return (
    <AnimatedContent distance={distance} duration={0.9} ease="power3.out" delay={delay}
      threshold={0.12} className={className}>
      {children}
    </AnimatedContent>
  )
}

/** Big section heading whose letters float up while scrolling (React Bits ScrollFloat). */
export function FloatHeading({ children, className = '' }) {
  const { motionOn } = useApp()
  if (!motionOn) return <h2 className={className}>{children}</h2>
  return (
    <ScrollFloat containerClassName="!my-0" textClassName={`!leading-tight ${className}`}
      animationDuration={1} stagger={0.025} distance={60}>
      {children}
    </ScrollFloat>
  )
}

/** Text band whose speed follows the scroll (React Bits ScrollVelocity). */
export function Marquee({ items, className = '' }) {
  const { motionOn } = useApp()
  const line = items.join('   ✦   ')
  if (!motionOn) {
    return <p className={`overflow-hidden whitespace-nowrap ${className}`}>{line}   ✦   {line}</p>
  }
  return <ScrollVelocity texts={[line]} velocity={40} className={className} />
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
export function Spotlight({ children, className = '', style, ...rest }) {
  const { motionOn, theme } = useApp()
  if (!motionOn) {
    return <div className={`relative rounded-3xl border border-line bg-surface ${className}`} style={style} {...rest}>{children}</div>
  }
  return (
    <SpotlightCard
      className={className}
      theme={theme}
      spotlightColor={theme === 'dark' ? 'rgba(214, 44, 62, 0.28)' : 'rgba(164, 22, 38, 0.16)'}
      intensity={0.2}
      style={{
        '--spotlight-card-surface': 'rgb(var(--surface))',
        '--spotlight-card-border': 'rgb(var(--line))',
        '--spotlight-card-shadow': '0 18px 40px -24px rgb(var(--ink) / 0.35)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </SpotlightCard>
  )
}

/** Call-to-action whose border has a travelling star (plain button when off). */
export function StarButton({ children, className = '', as = 'button', fill, ink, ...rest }) {
  const { motionOn, theme } = useApp()
  const v = VELVET[theme] ?? VELVET.light
  const bg = fill ?? v.accent
  const fg = ink ?? v.cream
  if (!motionOn) {
    const Tag = as
    return (
      <Tag className={`inline-flex items-center justify-center rounded-full px-6 py-3.5 font-medium ${className}`}
        style={{ background: bg, color: fg }} {...rest}>
        {children}
      </Tag>
    )
  }
  return (
    <StarBorder as={as} theme={theme} color={v.cream} trailColor={v.blush} radius={999} duration={5}
      glow={0.7} backgroundColor={bg} textColor={fg} className={className} {...rest}>
      {children}
    </StarBorder>
  )
}
