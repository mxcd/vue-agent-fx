import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// library build: one ES entry per subpath, vue + three left to the consumer
export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: {
        index: 'src/index.ts',
        'orbs/index': 'src/orbs/index.ts',
        'beam/index': 'src/beam/index.ts',
        'voice/index': 'src/voice/index.ts',
        'image/index': 'src/image/index.ts'
      },
      formats: ['es']
    },
    rollupOptions: { external: ['vue', /^three/] }
  }
});
