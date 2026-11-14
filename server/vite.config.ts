import { defineConfig } from 'vite';

// Production bundle of the API: `npm run build:server` writes dist-server/index.js (the server)
// and dist-server/crewCli.js (the crew tool). Everything, including hono and content.json, is
// bundled in, so the files run with plain `node` and no node_modules.
export default defineConfig({
  publicDir: false,
  ssr: { noExternal: true },
  build: {
    ssr: true,
    outDir: 'dist-server',
    emptyOutDir: true,
    target: 'node24',
    rollupOptions: {
      input: { index: 'server/src/index.ts', crewCli: 'server/src/crewCli.ts' },
      output: { format: 'esm', entryFileNames: '[name].js' },
    },
  },
});
