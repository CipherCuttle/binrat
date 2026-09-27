import { createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import type { Action } from 'svelte/action';
import GrainWave from './premium-grain/grain-wave';
import './premium-grain/grain-wave.css';

// Run the real licensed React component in a tiny React island without
// migrating BINRAT's Svelte 5 discovery / scanner / Radar application.
const OfficialGrainWave = GrainWave as ComponentType<any>;
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
  // Match the demo's geometry / texture / motion; change ONLY the palette.
  startColor:'#c060a8',
  endColor:'#ffd08a',
  darkBackground:'#20164e',
  lightBackground:'#f7ecc8'
};
export const mountOfficialGrainWave: Action<HTMLDivElement> = (host) => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const staticSky=new URLSearchParams(location.search).has('static-sky');
  let root:Root|undefined;
  let stopped=false;
  function unmount() {
    root?.unmount();
    root=undefined;
  }
  function update() {
    if(stopped) return;
    if(reduced.matches || staticSky) {
      unmount();
      host.dataset.grainRuntime=reduced.matches?'reduced-motion':'static-sky';
      return;
    }
    if(!root) {
      root=createRoot(host);
      root.render(createElement(ThemeProvider,{
        attribute:'class',
        forcedTheme:'dark',
        enableSystem:false,
        children:createElement(OfficialGrainWave,demoDefaults)
      }));
    }
    host.dataset.grainRuntime='official-mounted';
  }
  reduced.addEventListener('change',update);
  update();
  return {destroy() {
    stopped=true;
    reduced.removeEventListener('change',update);
    unmount();
  }};
};
