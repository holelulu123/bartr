const isProd = process.env.NODE_ENV === 'production';

function requireInProd(name: string, value: string | undefined, fallback: string): string {
  if (isProd && !value) {
    throw new Error(`${name} environment variable is required in production`);
  }
  return value ?? fallback;
}

// Dev fallback for ENCRYPTION_KEY: hex encoding of "bartr-dev-encryption-key-32bytes"
// (the same 32-byte key that crypto.ts historically used as its dev fallback).
const DEV_ENCRYPTION_KEY = '62617274722d6465762d656e6372797074696f6e2d6b65792d33326279746573';

// Run requireInProd check eagerly at startup so missing vars fail fast.
requireInProd('ENCRYPTION_KEY', process.env.ENCRYPTION_KEY, DEV_ENCRYPTION_KEY);

export const env = {
  port: parseInt(process.env.API_PORT || '4000', 10),
  host: process.env.API_HOST || '0.0.0.0',
  databaseUrl: requireInProd('DATABASE_URL', process.env.DATABASE_URL, 'postgresql://bartr:bartr_dev_password@localhost:5432/bartr'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: requireInProd('JWT_SECRET', process.env.JWT_SECRET, 'bartr-dev-jwt-secret-change-in-production'),
  // 64-char hex string (32 bytes). Required in production. Dev uses a deterministic fallback.
  // Getter so tests can override process.env.ENCRYPTION_KEY dynamically.
  get encryptionKey(): string {
    return process.env.ENCRYPTION_KEY ?? DEV_ENCRYPTION_KEY;
  },
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost',
  minioEndpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  minioAccessKey: requireInProd('MINIO_ROOT_USER', process.env.MINIO_ROOT_USER, 'bartr'),
  minioSecretKey: requireInProd('MINIO_ROOT_PASSWORD', process.env.MINIO_ROOT_PASSWORD, 'bartr_dev_password'),
  minioBucket: process.env.MINIO_BUCKET || 'listing-images',
  brevoApiKey: process.env.BREVO_API_KEY || '',
  brevoFromEmail: process.env.BREVO_FROM_EMAIL || 'noreply@bartr.app',
  healthServiceKey: process.env.HEALTH_SERVICE_KEY || '',
} as const;

// ---------------------------------------------------------------------------
// Production secrets validation
// ---------------------------------------------------------------------------
// In production, reject known dev defaults and weak secrets at startup so
// misconfigurations fail fast rather than at the first request.
// ---------------------------------------------------------------------------

if (isProd) {
  const errors: string[] = [];

  // JWT_SECRET: must not be the dev default and must be at least 32 characters
  if (env.jwtSecret === 'bartr-dev-jwt-secret-change-in-production' || env.jwtSecret === 'change-me-in-production') {
    errors.push('JWT_SECRET is still set to a dev default — generate a real secret for production');
  } else if (env.jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  // ENCRYPTION_KEY: must be exactly 64 hex characters
  if (!/^[0-9a-fA-F]{64}$/.test(env.encryptionKey)) {
    errors.push('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  if (env.encryptionKey === DEV_ENCRYPTION_KEY) {
    errors.push('ENCRYPTION_KEY is still set to the dev fallback — generate a real key with: openssl rand -hex 32');
  }

  // POSTGRES_PASSWORD: must not be the dev default
  const pgUrl = env.databaseUrl;
  if (pgUrl.includes('bartr_dev_password')) {
    errors.push('DATABASE_URL still contains the dev default password "bartr_dev_password"');
  }

  // MINIO_ROOT_PASSWORD: must not be the dev default
  if (env.minioSecretKey === 'bartr_dev_password') {
    errors.push('MINIO_ROOT_PASSWORD is still set to "bartr_dev_password"');
  }

  if (errors.length > 0) {
    throw new Error(
      `Production secrets audit failed:\n  - ${errors.join('\n  - ')}\n\nRun: bash scripts/generate-secrets.sh`,
    );
  }
}
