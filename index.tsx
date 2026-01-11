
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

// Global Error Handler for "Black Screen" Debugging
window.onerror = function (message, source, lineno, colno, error) {
  document.body.innerHTML = `
    <div style="color: #ff5555; padding: 20px; font-family: monospace; background: #000; height: 100vh;">
      <h1 style="font-size: 24px; margin-bottom: 20px;">⚠️ Application Crash</h1>
      <p><strong>Error:</strong> ${message}</p>
      <p><strong>Location:</strong> ${source}:${lineno}</p>
      <pre style="background: #222; padding: 10px; overflow: auto; margin-top: 20px;">${error?.stack || 'No stack trace'}</pre>
    </div>
  `;
};

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (e: any) {
  console.error("Mounting error:", e);
  document.body.innerHTML = `<h1>Mount Error: ${e.message}</h1>`;
}
