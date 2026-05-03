import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

history.scrollRestoration = 'manual';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch((err) => console.warn('SW registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
