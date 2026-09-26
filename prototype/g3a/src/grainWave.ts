import type { Action } from 'svelte/action';

/**
 * Original BINRAT grain-wave sky. This is deliberately a small 2D canvas,
 * not a shader, React Bits port, video or pointer-reactive visual.
 * Fine contour lines make the motion perceptible in a few seconds.
 * The existing CSS gradient/SVG remains visible before JS and in fallback.
 */
export const grainWave: Action<HTMLCanvasElement> = (canvas) => {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return {};
  const ctx = context;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 760px)');
  let frame = 0;
  let frameCount = 0;
  let lastDraw = 0;
  let startTime = performance.now();
  let visible = true;
  let disposed = false;
  const palette = [
    [132, 104, 226], // indigo-violet
    [193, 102, 194], // rose-magenta
    [244, 161, 121], // warm apricot
    [255, 211, 150], // pale gold
    [247, 236, 200]  // cream highlight
  ] as const;

  // Each contour is individually drawn; grouped moving gradients produced the
  // previous static-looking result and are insufficient as a motion proof.
  function draw(seconds: number) {
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h || disposed) return;
    ctx.clearRect(0, 0, w, h);
    const numberOfContours = mobile.matches ? 31 : 42;
    const gap = mobile.matches ? 3 : 4;
    const amplitude = mobile.matches ? 0.027 : 0.036;

    // A restrained soft underlay followed by crisp, intermittently broken
    // pixel-sized crests. Both share the same smooth geometry.
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < numberOfContours; i++) {
        const k = i / (numberOfContours - 1);
        const palettePosition = k * (palette.length - 1);
        const index = Math.min(palette.length - 2, Math.floor(palettePosition));
        const fraction = palettePosition - index;
        const [ar, ag, ab] = palette[index];
        const [br, bg, bb] = palette[index + 1];
        const r = Math.round(ar + (br - ar) * fraction);
        const g = Math.round(ag + (bg - ag) * fraction);
        const b = Math.round(ab + (bb - ab) * fraction);
        const crest = Math.exp(-Math.pow((k - 0.68) * 2.4, 2));
        const alpha = pass === 0
          ? 0.12 + crest * 0.11
          : 0.31 + crest * 0.32;
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.lineWidth = pass === 0 ? (mobile.matches ? 4.4 : 5.8) : (mobile.matches ? 1.15 : 1.25);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let active = false;
        for (let x = 0; x <= w + gap; x += gap) {
          const u = x / w;
          const major = Math.sin(u * 8.8 - seconds * 0.67 + k * 5.1);
          const rolling = Math.sin(u * 4.1 + seconds * 0.47 - k * 2.3);
          const detail = Math.sin(u * 17.5 - seconds * 0.31 + k * 12.2);
          const y = h * (0.17 + k * 0.64
            + amplitude * (major * 0.69 + rolling * 0.45)
            + 0.006 * detail);
          const gapAt = pass === 1 && ((Math.floor(x / (gap * 4)) * 13 + i * 7) % 41 === 0);
          if (!active || gapAt) {
            ctx.moveTo(x, y);
            active = !gapAt;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    }
    frameCount += 1;
    canvas.dataset.grainFrame = String(frameCount);
  }

  function measure() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return false;
    // Render small, upscale gently and retain the original stationary
    // CSS grain. No full-resolution per-pixel turbulence on mobile.
    const width = Math.max(180, Math.min(720, Math.round(rect.width * (mobile.matches ? 0.78 : 0.62))));
    const height = Math.max(180, Math.min(520, Math.round(rect.height * (mobile.matches ? 0.66 : 0.70))));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return true;
  }

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  }

  function tick(now: number) {
    frame = 0;
    if (disposed || !visible || document.hidden || reduced.matches) return;
    const interval = mobile.matches ? 72 : 52;
    if (now - lastDraw >= interval) {
      draw((now - startTime) / 1000);
      lastDraw = now;
    }
    frame = requestAnimationFrame(tick);
  }

  function restart() {
    stop();
    if (!measure()) return;
    startTime = performance.now();
    lastDraw = startTime;
    draw(0); // Visible on first paint and in reduced-motion.
    if (!reduced.matches && visible && !document.hidden) {
      frame = requestAnimationFrame(tick);
    }
  }

  const onVisibility = () => {
    if (document.hidden) stop();
    else restart();
  };
  const onMotionChange = () => restart();
  const onViewportChange = () => restart();
  reduced.addEventListener('change', onMotionChange);
  mobile.addEventListener('change', onViewportChange);
  document.addEventListener('visibilitychange', onVisibility);
  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(() => restart());
  resizeObserver?.observe(canvas.parentElement ?? canvas);
  const intersectionObserver = typeof IntersectionObserver === 'undefined'
    ? null
    : new IntersectionObserver(entries => {
        const nextVisible = entries.some(entry => entry.isIntersecting);
        if (nextVisible === visible) return;
        visible = nextVisible;
        if (visible) restart();
        else stop();
      }, { threshold: 0.01 });
  intersectionObserver?.observe(canvas);
  restart();

  return {
    destroy() {
      disposed = true;
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onMotionChange);
      mobile.removeEventListener('change', onViewportChange);
    }
  };
};
