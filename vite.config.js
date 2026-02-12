import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  
  build: {
    outDir: 'dist',
    assetsDir: '',  // Пустая строка = всё в корень
    
    sourcemap: false,
    minify: 'esbuild',
    
    rollupOptions: {
      output: {
        entryFileNames: 'game.js',
        chunkFileNames: 'game.js',
        assetFileNames: (assetInfo) => {
          // Все ассеты в корень БЕЗ хешей
          return '[name].[ext]';
        }
      }
    }
  },
  
  server: {
    port: 5173
  }
})