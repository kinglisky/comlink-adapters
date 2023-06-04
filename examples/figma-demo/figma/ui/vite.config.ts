import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    plugins: [viteSingleFile()],
    build: {
        minify: process.argv.includes('watch'),
        outDir: resolve(__dirname, '../../dist'),
        rollupOptions: {
            output: {
                format: 'iife',
            },
            external: ['electron'],
        },
    },
});
