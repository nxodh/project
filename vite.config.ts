import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 상대 경로로 빌드해 dist 폴더를 어느 경로에 올려도 동작하게 한다.
  base: './',
  server: { host: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
