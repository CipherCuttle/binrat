/** BINRAT-adapted React Bits starter patterns (SpotlightCard, ShinyText, StarBorder).
 * Design ideas from https://github.com/DavidHDev/react-bits
 * License/copyright: docs/licenses/REACT_BITS_LICENSE.md
 * These are intentionally small project-specific adaptations, not full upstream API ports.
 * No external deps, global listeners, timers, canvas, or network access.
 */
import { useState } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, PointerEvent, ReactNode } from 'react';

type SpotlightProps = Omit<HTMLAttributes<HTMLElement>, 'onPointerMove'> & {
  children: ReactNode;
  className?: string;
};
export function SpotlightCard({ children, className = '', ...props }: SpotlightProps) {
  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse') return; // pointer effects shouldn't track touch scroll
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--rb-spot-x', (event.clientX - rect.left) + 'px');
    event.currentTarget.style.setProperty('--rb-spot-y', (event.clientY - rect.top) + 'px');
  }
  return <aside {...props} className={'rb-spotlight ' + className} onPointerMove={onPointerMove}>
    {children}
  </aside>;
}

type ShinyProps = { children: ReactNode; className?: string };
export function ShinyText({ children, className = '' }: ShinyProps) {
  return <span className={'rb-shiny-text ' + className}>{children}</span>;
}

type StarBorderProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };
export function StarBorder({ children, className = '', type = 'button', ...props }: StarBorderProps) {
  return <button {...props} type={type} className={'rb-star-border ' + className}>{children}</button>;
}

/** GlareHover-inspired: accessible button, CSS-only controlled sheen. */
export function GlareHoverButton({ children, className = '', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} type={type} className={'rb-glare-hover ' + className}>{children}</button>;
}

/** ClickSpark-inspired: a brief non-interactive flourish after normal button activation.
 * Uses a keyed visual span to replay the CSS animation; no timers or global listeners.
 */
export function ClickSparkButton({ children, className = '', type = 'button', onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const [tick, setTick] = useState(0);
  return <button {...props} type={type} className={'rb-click-spark ' + className}
    onClick={event => { if (props.disabled) return; setTick(n => n+1); onClick?.(event); }}>
    {children}
    {tick > 0 && <span key={tick} className="rb-spark-burst" aria-hidden="true" />}
  </button>;
}
