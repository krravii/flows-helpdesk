import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.DOCKER_ENV === 'true' ? 'http://api:4000' : 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: 'http://api:4000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://api:4000',
        ws: true
      }
    }
  }
});
