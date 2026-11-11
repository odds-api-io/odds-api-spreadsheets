import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  root: 'pane',
  plugins: [preact(), viteSingleFile()],
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2020', assetsInlineLimit: 100_000_000, cssCodeSplit: false, copyPublicDir: false },
  test: { root: '.', environment: 'node', include: ['pane/test/**/*.test.ts', 'sheets/test/**/*.test.ts'] },
})
