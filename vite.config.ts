import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Rutas relativas: el sitio funciona en cualquier carpeta (por ejemplo, GitHub Pages).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.svg', 'ejemplos/*.json'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
      },
      manifest: {
        name: 'Repasario',
        short_name: 'Repasario',
        description: 'Cuestionarios para repasar cualquier materia, sin cuenta y sin conexión.',
        lang: 'es',
        theme_color: '#213b72',
        background_color: '#f4f7fb',
        display: 'standalone',
        icons: [{ src: 'icono.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['fake-indexeddb/auto'],
  },
});
