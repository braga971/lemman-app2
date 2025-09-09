import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configure for GitHub Pages deployment
// - base: repository name so assets resolve under /<repo>/
// - build.outDir: optional, emit to docs/ if using Pages from /docs
// Auto-detect correct base for GitHub Pages
// - User/Org page repos (e.g. <name>.github.io) use '/'
// - Project pages use '/<repo>/'
const explicitBase = process.env.VITE_BASE
const repo = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : ''
const isUserPage = repo.endsWith('.github.io')
const computedBase = isUserPage ? '/' : (repo ? `/${repo}/` : '/')
const base = explicitBase ?? computedBase

export default defineConfig({
  plugins: [react()],
  base,
  // Keep default outDir 'dist' to match the GitHub Actions workflow
})
