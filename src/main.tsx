import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { registerOfflineCache } from './ui/appMode';

registerOfflineCache();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Respecteert "minder beweging" van het besturingssysteem. */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
