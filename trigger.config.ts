import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: 'proj_gpezmczexvqqcasyjdmk',
  dirs: ['./src/trigger'],
  maxDuration: 300, // 5 minutes max per task run
  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
});
