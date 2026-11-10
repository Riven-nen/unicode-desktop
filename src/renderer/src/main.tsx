// Side-effect import: registers local Monaco workers and switches
// @monaco-editor/react's loader from its CDN default to the bundled build.
import './lib/monaco'
// Bundled @font-face rules for the UI and code fonts (see fonts/fonts.ts).
import './fonts/fonts.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Platform hint so CSS can adjust for OS-specific chrome (e.g. reserving
// space for the macOS traffic lights next to our custom title bar).
document.documentElement.dataset.platform = window.api?.platform ?? 'win32'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
