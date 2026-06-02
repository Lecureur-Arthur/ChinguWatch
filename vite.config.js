import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuration corrigée avec la casse exacte du dépôt
export default defineConfig({
  base: '/ChinguWatch/',
  plugins: [react()],
})