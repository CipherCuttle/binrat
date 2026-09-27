import type { Action } from 'svelte/action';
import type { Root } from 'react-dom/client';
import './premium-grain/grain-wave.css';

// R5 approved demo values. Do not modify the visual preset during integration.
// The expensive 3D/React modules are loaded only after WebGL and motion checks.
const demoDefaults = {
  width:'100%',
  height:'100%',
  speed:0.5,
  waveCount:25,
  waveAmplitude:0.85,
  waveFrequency:4,
  waveWidth:3.5,
  speedVariation:0.006,
  lineThickness:0.2,
  grainIntensity:50,
  scale:0.6,
  brightness:1,
  startColor:'#ff6666',
  endColor:'#6666ff',
  darkBackground:'#333333',
  lightBackground:'#ffffff'
};

function canRenderWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return false;
    // Release the disposable probe: the licensed component creates its own context.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export const mountOfficialGrainWave: Action<HTMLDivElement> = (host) => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const params = new URLSearchParams(location.search);
  const staticSky = params.has('static-sky');
  const demoIsolate = params.has('demo-isolate');
  if (demoIsolate) document.documentElement.classList.add('grain-demo-isolate');
  host.dataset.wavePreset = 'reactbits-demo-defaults';

  let root: Root | undefined;
  let stopped = false;
  let contextLost = false;
  let loadFailed = false;
  let webglSupported: boolean | undefined;
  let generation = 0;
  let mounting = false;
  let observer: MutationObserver | undefined;

  function fallback(reason: string) {
    host.dataset.grainRuntime = reason;
    host.parentElement?.classList.add('grain-wave-fallback');
  }
  function clearRoot() {
    generation += 1; // Cancel any in-flight, lazy module import.
    observer?.disconnect();
    observer = undefined;
    if (root) {
      const old = root;
      root = undefined;
      old.unmount();
    }
    mounting = false;
  }
  function deactivate(reason: string) {
    clearRoot();
    fallback(reason);
  }
  async function activate() {
    if (stopped || root || mounting) return;
    if (reduced.matches) { fallback('reduced-motion'); return; }
    if (staticSky) { fallback('static-sky'); return; }
    if (contextLost) { fallback('context-lost'); return; }
    if (loadFailed) { fallback('load-failed'); return; }
    if (document.visibilityState === 'hidden') { fallback('paused-hidden'); return; }
    if (webglSupported === undefined) webglSupported = canRenderWebGL2();
    if (!webglSupported) { fallback('webgl-unavailable'); return; }

    const current = ++generation;
    mounting = true;
    fallback('official-loading');
    try {
      // Code-split the licensed shader and its React/Three runtime out of the
      // Svelte application's initial bundle and every low-power fallback path.
      const [react, dom, themes, grain] = await Promise.all([
        import('react'),
        import('react-dom/client'),
        import('next-themes'),
        import('./premium-grain/grain-wave')
      ]);
      if (stopped || current !== generation || reduced.matches ||
          document.visibilityState === 'hidden') return;
      observer = new MutationObserver(() => {
        if (!host.querySelector('canvas')) return;
        observer?.disconnect();
        observer = undefined;
        host.parentElement?.classList.remove('grain-wave-fallback');
        host.dataset.grainRuntime = 'official-mounted';
      });
      observer.observe(host, { childList:true, subtree:true });
      root = dom.createRoot(host, {
        onUncaughtError() {
          // WebGL initialization can fail after feature detection on Android.
          // Defer unmount until React has finished dispatching the error.
          loadFailed = true;
          queueMicrotask(() => { if (!stopped) deactivate('load-failed'); });
        }
      });
      root.render(react.createElement(themes.ThemeProvider, {
        attribute:'class',
        forcedTheme:'dark',
        enableSystem:false,
        children:react.createElement(grain.default, demoIsolate ? demoDefaults : {
          ...demoDefaults,
          // The integrated R5 hero selects the ORIGINAL demo's dark background.
          lightBackground:'#333333'
        })
      }));
    } catch {
      if (!stopped && current === generation) {
        loadFailed = true;
        deactivate('load-failed');
      }
    } finally {
      if (current === generation) mounting = false;
    }
  }
  function onVisibilityChange() {
    if (stopped) return;
    if (document.visibilityState === 'hidden') deactivate('paused-hidden');
    else void activate();
  }
  function onMotionChange() {
    if (stopped) return;
    if (reduced.matches) deactivate('reduced-motion');
    else void activate();
  }
  function onContextLost(event: Event) {
    // Capture from the React-owned canvas without modifying its source.
    event.preventDefault();
    contextLost = true;
    if (!stopped) queueMicrotask(() => { if (!stopped) deactivate('context-lost'); });
  }

  host.addEventListener('webglcontextlost', onContextLost, true);
  reduced.addEventListener('change', onMotionChange);
  document.addEventListener('visibilitychange', onVisibilityChange);
  void activate();

  return {
    destroy() {
      stopped = true;
      host.removeEventListener('webglcontextlost', onContextLost, true);
      reduced.removeEventListener('change', onMotionChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearRoot();
      host.parentElement?.classList.remove('grain-wave-fallback');
      if (demoIsolate) document.documentElement.classList.remove('grain-demo-isolate');
    }
  };
};
