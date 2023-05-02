import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        emptyOutDir: false,
        lib: {
            entry: './src/index.ts',
            name: 'comlink-adapters',
            formats: ['umd', 'es', 'cjs'],
        },
        rollupOptions: {
            external: ['electron', 'comlink'],
        },
    },
    plugins: [dts()],
});
