import { createElement, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import type { Action } from 'svelte/action';
import * as OfficialModule from './premium-grain/grain-wave';
import './premium-grain/grain-wave.css';

// Run the real licensed React component in a tiny React island without
// migrating BINRAT's Svelte 5 discovery / scanner / Radar application.
const GrainWave = (OfficialModule.default ?? (OfficialModule as {GrainWave?:ComponentType<any>}).GrainWave) as ComponentType<any>;
if (!GrainWave) throw new Error('Official React Bits Grain Wave export unavailable');
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
  let root:Root|undefined;
  let stopped=false;
  function unmount() {
    root?.unmount();
    root=undefined;
  }
  function update() {
    if(stopped) return;
    if(reduced.matches) {
      unmount();
      host.dataset.grainRuntime='reduced-motion';
      return;
    }
    if(!root) {
      root=createRoot(host);
      root.render(createElement(ThemeProvider,{
        attribute:'class',
        forcedTheme:'dark',
        enableSystem:false,
        children:createElement(GrainWave,demoDefaults)
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
