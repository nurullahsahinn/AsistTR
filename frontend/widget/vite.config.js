import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/widget.js',
      name: 'AsistTRWidget',
      fileName: () => 'widget.js',
      formats: ['iife']
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})


