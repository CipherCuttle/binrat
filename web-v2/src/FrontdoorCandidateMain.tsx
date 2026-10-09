import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import FrontdoorCandidateApp from './FrontdoorCandidateApp';
import './styles.css';

// Isolated candidate entry. Never imports the historical ARC V2 application.
createRoot(document.getElementById('root')!).render(
  <StrictMode><FrontdoorCandidateApp /></StrictMode>
);
