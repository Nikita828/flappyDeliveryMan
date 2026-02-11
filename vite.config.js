import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    
    rollupOptions: {
      external: ['phaser']
    },
    
    minify: 'esbuild',
    sourcemap: false,
    
    // Копировать только нужные файлы из public
    copyPublicDir: true
  },
  
  // Исключаем моки из копирования
  publicDir: 'public',
  
  server: {
    port: 5173,
    open: true
  }
})