import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is './' so the build works both locally and on GitHub Pages (project subpath)
export default defineConfig({
  plugins: [react()],
  base: './',
})
