import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/ogp', fullyParallel:false, timeout:30000,
  outputDir:'.cache/ogp-results',
  reporter:[['list'],['json',{outputFile:'.cache/ogp-report.json'}]],
  use:{baseURL:process.env.OGP_BASE_URL ?? 'http://127.0.0.1:8787'},
  webServer:process.env.OGP_BASE_URL ? undefined : {
    command:'node node_modules/wrangler/bin/wrangler.js dev --local --ip 127.0.0.1 --port 8787 --persist-to .cache/ogp-runtime',
    url:'http://127.0.0.1:8787', reuseExistingServer:false, timeout:120000,
    env:{CLOUDFLARE_SEND_METRICS:'false'},
  },
});
