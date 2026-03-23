import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

history.scrollRestoration = 'manual';

createRoot(document.getElementById("root")!).render(<App />);
