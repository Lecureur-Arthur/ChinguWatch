import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuration de Vite adaptée pour le déploiement en production
export default defineConfig({
  // Je définis le chemin de base avec le nom exact de mon dépôt GitHub entre barres obliques
  base: '/chinguwatch/',
  plugins: [react()],
})