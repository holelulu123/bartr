import { APP_NAME } from '@bartr/shared';

console.log(`[${APP_NAME}] Workers ready — waiting for jobs`);

// Keep the process alive
setInterval(() => {}, 60_000);
