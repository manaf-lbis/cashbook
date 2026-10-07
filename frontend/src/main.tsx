import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Auto-recover from dynamic module import failures after deployments (Vite preload errors)
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Preload error detected for dynamic chunk. Auto-refreshing...', event);
    window.location.reload();
  });

  // Purge legacy caches from previous service worker versions if present
  if ('caches' in window) {
    window.caches.keys().then((names) => {
      for (const name of names) {
        if (name !== 'cashbook-pwa-v3') {
          window.caches.delete(name);
        }
      }
    });
  }
}


// Register Progressive Web App Service Worker (Mobile & Windows installation)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker active with scope:', reg.scope);
        // Prompt immediate update check
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration note:', err);
      });
  });
}


ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

