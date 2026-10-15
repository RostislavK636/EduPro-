import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e',use:{baseURL:process.env.EDUPILOT_TEST_URL||'http://127.0.0.1:3000',headless:true,channel:'msedge'},expect:{timeout:15000},timeout:90000,workers:1,reporter:'list'});
