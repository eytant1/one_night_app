import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { collectUnusedMedia } from './db';
import './styles.css';

registerSW({ immediate: true });
navigator.storage?.persist?.();
collectUnusedMedia();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
