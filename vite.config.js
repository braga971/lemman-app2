import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configure for GitHub Pages deployment
// - base: repository name so assets resolve under /<repo>/
// - build.outDir: optional, emit to docs/ if using Pages from /docs
export default defineConfig({
  plugins: [react()],
  base: '/lemman-app2/',
  // Keep default outDir 'dist' to match the GitHub Actions workflow
})
