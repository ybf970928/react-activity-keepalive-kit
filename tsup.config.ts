import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm', 'cjs'],
  dts: true,
  external: ['react'],
  treeshake: true,
  minify: false,
  sourcemap: true,
  clean: true,
  target: 'es2020',
});
