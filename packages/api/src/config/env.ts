const isProd = process.env.NODE_ENV === 'production';

function requireInProd(name: string, value: string | undefined, fallback: string): string {
  if (isProd && !value) {
    throw new Error(`${name} environment variable is required in production`);
  }
  return value ?? fallback;
}

export const env = {
  port: parseInt(process.env.API_PORT || '4000', 10),
  host: process.env.API_HOST || '0.0.0.0',
  databaseUrl: requireInProd('DATABASE_URL', process.env.DATABASE_URL, 'postgresql://bartr:bartr_dev_password@localhost:5432/bartr'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: requireInProd('JWT_SECRET', process.env.JWT_SECRET, 'bartr-dev-jwt-secret-change-in-production'),
  // 64-char hex string (32 bytes). Required in production. Dev uses a deterministic fallback.
  encryptionKey: process.env.ENCRYPTION_KEY,
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost',
  minioEndpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  minioAccessKey: requireInProd('MINIO_ROOT_USER', process.env.MINIO_ROOT_USER, 'bartr'),
  minioSecretKey: requireInProd('MINIO_ROOT_PASSWORD', process.env.MINIO_ROOT_PASSWORD, 'bartr_dev_password'),
  minioBucket: process.env.MINIO_BUCKET || 'listing-images',
} as const;
