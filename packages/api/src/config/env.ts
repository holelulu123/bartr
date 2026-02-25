export const env = {
  port: parseInt(process.env.API_PORT || '4000', 10),
  host: process.env.API_HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://bartr:bartr_dev_password@localhost:5432/bartr',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
} as const;
