import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Isto manda o Vite ignorar os "warnings" de variáveis não utilizadas ou outros errinhos cosméticos na hora de compilar
  build: {
    chunkSizeWarningLimit: 1600,
  }
})