import { resolve } from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
    build: {
        minify: process.argv.includes('watch'),
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['iife'],
            name: 'core',
            fileName: 'core',
        },
        rollupOptions: {
            external: ['electron'],
        },
        outDir: resolve(__dirname, '../../dist'),
    },
});
