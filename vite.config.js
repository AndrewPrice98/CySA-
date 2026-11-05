import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The bundle is mostly study text (notes, 200+ questions, 300+ terms): ~240 kB gzipped; labs load as a separate chunk
  build: { chunkSizeWarningLimit: 1000 },
})
