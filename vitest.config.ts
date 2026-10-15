import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({test:{include:['tests/**/*.test.ts'],environment:'node'},resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url)),'@local-db':fileURLToPath(new URL('./lib/local-database.ts',import.meta.url))}}});
