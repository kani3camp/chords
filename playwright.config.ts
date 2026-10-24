import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'tests/e2e', fullyParallel:true, timeout:30000,
  expect:{timeout:5000}, retries:process.env.CI?1:0,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:process.env.CHORDS_BASE_URL??'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:process.env.CHORDS_BASE_URL?undefined:{command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173',port:4173,reuseExistingServer:!process.env.CI},
  projects:[
    {name:'chromium-desktop',use:{browserName:'chromium',viewport:{width:1440,height:1000}}},
    {name:'chromium-tablet',use:{browserName:'chromium',viewport:{width:834,height:1194},hasTouch:true}},
    {name:'webkit-tablet',use:{browserName:'webkit',viewport:{width:834,height:1194},hasTouch:true}},
    {name:'edge-desktop',use:{browserName:'chromium',channel:'msedge',viewport:{width:1440,height:1000}}},
  ]
});
