import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pin the dev port so the app is always at http://localhost:5173. strictPort
  // makes Vite fail loudly if 5173 is taken instead of silently drifting to
  // 5174/5175 and leaving you on a stale tab.
  server: { port: 5173, strictPort: true },
})
