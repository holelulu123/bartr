import fp from 'fastify-plugin';
import * as Minio from 'minio';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    minio: Minio.Client;
    minioBucket: string;
  }
}

export default fp(async (fastify) => {
  const url = new URL(env.minioEndpoint);
  const client = new Minio.Client({
    endPoint: url.hostname,
    port: parseInt(url.port || '9000', 10),
    useSSL: url.protocol === 'https:',
    accessKey: env.minioAccessKey,
    secretKey: env.minioSecretKey,
  });

  const bucket = env.minioBucket;

  // Ensure bucket exists
  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
    fastify.log.info(`Created MinIO bucket: ${bucket}`);
  }

  fastify.log.info('MinIO connected');
  fastify.decorate('minio', client);
  fastify.decorate('minioBucket', bucket);
});
