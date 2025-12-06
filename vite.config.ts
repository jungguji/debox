import { defineConfig } from 'vite'

export default defineConfig({
  base: '/debox/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
