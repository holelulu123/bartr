import { APP_NAME } from '@bartr/shared';
import { startPriceFeed } from './jobs/price-feed.js';

console.log(`[${APP_NAME}] Workers starting...`);

startPriceFeed();

console.log(`[${APP_NAME}] Workers ready — all jobs running`);
