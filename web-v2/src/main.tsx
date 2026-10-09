import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// A separately compiled static candidate entry, never selected in normal V2.
const candidate = import.meta.env.VITE_BINRAT_V3_CANDIDATE === '1';
const component = candidate ? import('./FrontdoorCandidateApp') : import('./App');
void component.then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
});
