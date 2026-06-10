import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/new/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Prefer TS/Vue sources over stale compiled .js siblings under src/
    extensions: ['.mjs', '.mts', '.ts', '.tsx', '.vue', '.jsx', '.js', '.json'],
  },
})
