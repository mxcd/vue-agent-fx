import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// builds the demo; relative base so it works under any GitHub Pages path
export default defineConfig({
  root: 'demo',
  base: './',
  plugins: [vue()],
  build: { outDir: '../dist-demo', emptyOutDir: true }
});
