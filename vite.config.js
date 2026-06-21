import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Je définis la configuration de base pour Vite avec le plugin React et la bonne casse du dépôt
export default defineConfig({
  base: '/ChinguWatch/',
  plugins: [react()],
})