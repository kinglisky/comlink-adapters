import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    build: {
        emptyOutDir: false,
        lib: {
            entry: './src/index.ts',
            name: 'comlink-adapters',
            formats: ['es', 'cjs', 'umd'],
        },
        rollupOptions: {
            external: ['electron', 'comlink'],
        },
        minify: !process.argv.includes('--watch'),
    },
    plugins: [dts()],
});
