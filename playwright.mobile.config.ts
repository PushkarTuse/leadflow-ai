import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir:'tests/mobile', outputDir:'test-results/mobile', fullyParallel:false,
  timeout:90000, workers:1,
  use:{trace:'retain-on-failure',reducedMotion:'no-preference'},
  projects:[
    {name:'iphone-chromium',use:{...devices['iPhone 13'],browserName:'chromium'}},
    {name:'android-chromium',use:{...devices['Pixel 7'],browserName:'chromium'}},
    ...(process.env.SCENE_TEST_WEBKIT === 'true' ? [{name:'iphone-webkit',use:{...devices['iPhone 13'],browserName:'webkit' as const}}] : []),
  ],
  webServer:process.env.SCENE_LIVE === 'true' ? undefined : [
    {command:'npm run dev -- --port 5183',url:'http://127.0.0.1:5183',reuseExistingServer:false,env:{VITE_INTAKE_ENABLED:'false'},timeout:60000},
    {command:'npm run dev:marketing -- --port 5185',url:'http://127.0.0.1:5185',reuseExistingServer:false,env:{VITE_MARKETING_INTAKE_ENABLED:'false'},timeout:60000},
  ],
  reporter:'list',
});
