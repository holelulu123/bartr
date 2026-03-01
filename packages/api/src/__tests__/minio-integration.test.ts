import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';
import { signAccessToken } from '../lib/jwt.js';

/**
 * MinIO Integration Tests (Phase 13.8)
 *
 * These tests require MinIO running on localhost:9000 (default dev config).
 * Run with: docker compose -f docker-compose.dev.yml up -d minio postgres redis
 */

describe('MinIO Integration — Listing Images', () => {
  let app: FastifyInstance;
  let userId: string;
  let userNickname: string;
  let userToken: string;
  let listingId: string;
  let otherUserId: string;
  let otherUserToken: string;

  // Create minimal valid image buffers for testing
  async function makeJpeg(): Promise<Buffer> {
    return sharp({ create: { width: 10, height: 10, channels: 3, background: '#ff0000' } })
      .jpeg({ quality: 85 })
      .toBuffer();
  }
  async function makePng(): Promise<Buffer> {
    return sharp({ create: { width: 10, height: 10, channels: 4, background: '#00ff00' } })
      .png()
      .toBuffer();
  }
  async function makeWebp(): Promise<Buffer> {
    return sharp({ create: { width: 10, height: 10, channels: 3, background: '#0000ff' } })
      .webp({ quality: 85 })
      .toBuffer();
  }

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();

    // Create two test users directly in the DB
    const suffix = `minio_${Date.now()}`;
    const user1 = await app.pg.query(
      `INSERT INTO users (nickname, password_hash, bio, email_verified)
       VALUES ($1, 'hash', '', TRUE) RETURNING id, nickname`,
      [`miniotest_owner_${suffix}`],
    );
    userId = user1.rows[0].id;
    userNickname = user1.rows[0].nickname;
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [userId]);
    userToken = await signAccessToken({ sub: userId, nickname: userNickname });

    const user2 = await app.pg.query(
      `INSERT INTO users (nickname, password_hash, bio, email_verified)
       VALUES ($1, 'hash', '', TRUE) RETURNING id, nickname`,
      [`miniotest_other_${suffix}`],
    );
    otherUserId = user2.rows[0].id;
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [otherUserId]);
    otherUserToken = await signAccessToken({ sub: otherUserId, nickname: user2.rows[0].nickname });
  });

  beforeEach(async () => {
    // Create a fresh listing for each test
    const result = await app.pg.query(
      `INSERT INTO listings (user_id, title, description, category_id, payment_methods)
       VALUES ($1, 'Test Listing', 'For image tests', 1, '["cash"]')
       RETURNING id`,
      [userId],
    );
    listingId = result.rows[0].id;
  });

  afterAll(async () => {
    // Clean up all test data
    await app.pg.query("DELETE FROM listing_images WHERE listing_id IN (SELECT id FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'miniotest_%'))");
    await app.pg.query("DELETE FROM listings WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'miniotest_%')");
    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'miniotest_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'miniotest_%'");

    // Clean up MinIO objects
    try {
      const stream = app.minio.listObjects(app.minioBucket, 'listings/', true);
      for await (const obj of stream) {
        if (obj.name) await app.minio.removeObject(app.minioBucket, obj.name);
      }
    } catch { /* ignore */ }

    await app.close();
  });

  // ── Upload Tests ──────────────────────────────────────────────────────────

  it('uploads a JPEG image successfully', async () => {
    const jpeg = await makeJpeg();

    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'test.jpg');

    const res = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: {
        authorization: `Bearer ${userToken}`,
      },
      payload: form,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.storage_key).toMatch(/^listings\/.+\.jpg$/);
    expect(body.order_index).toBe(0);
  });

  it('uploads a PNG image successfully', async () => {
    const png = await makePng();

    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'test.png');

    const res = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.storage_key).toMatch(/\.png$/);
  });

  it('uploads a WebP image successfully', async () => {
    const webp = await makeWebp();

    const form = new FormData();
    form.append('file', new Blob([webp], { type: 'image/webp' }), 'test.webp');

    const res = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.storage_key).toMatch(/\.webp$/);
  });

  it('rejects non-image files (garbage bytes)', async () => {
    const garbage = Buffer.from('this is not an image file at all just text');

    const form = new FormData();
    form.append('file', new Blob([garbage], { type: 'application/octet-stream' }), 'malicious.jpg');

    const res = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/invalid image/i);
  });

  it('rejects oversized files (>5 MB)', async () => {
    // Create a buffer just over 5 MB
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff);

    const form = new FormData();
    form.append('file', new Blob([oversized], { type: 'image/jpeg' }), 'huge.jpg');

    const res = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });

    // Fastify multipart plugin rejects files over fileSize limit
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it('rejects upload from non-owner', async () => {
    const jpeg = await makeJpeg();

    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'test.jpg');

    const res = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${otherUserToken}` },
      payload: form,
    });

    expect(res.statusCode).toBe(403);
  });

  it('rejects upload without auth', async () => {
    const jpeg = await makeJpeg();

    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'test.jpg');

    const res = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      payload: form,
    });

    expect(res.statusCode).toBe(401);
  });

  // ── Delete Tests ──────────────────────────────────────────────────────────

  it('deletes an image from MinIO and DB', async () => {
    // Upload first
    const jpeg = await makeJpeg();
    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'test.jpg');

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });
    const { id: imageId, storage_key } = uploadRes.json();

    // Verify file exists in MinIO
    const stat = await app.minio.statObject(app.minioBucket, storage_key);
    expect(stat.size).toBeGreaterThan(0);

    // Delete
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/listings/${listingId}/images/${imageId}`,
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(deleteRes.statusCode).toBe(200);

    // Verify removed from DB
    const dbCheck = await app.pg.query(
      'SELECT id FROM listing_images WHERE id = $1',
      [imageId],
    );
    expect(dbCheck.rows.length).toBe(0);

    // Verify removed from MinIO
    try {
      await app.minio.statObject(app.minioBucket, storage_key);
      expect.fail('Object should have been deleted from MinIO');
    } catch (err: unknown) {
      // Expected: NotFound
      expect((err as { code?: string }).code).toBe('NotFound');
    }
  });

  it('rejects delete from non-owner', async () => {
    const jpeg = await makeJpeg();
    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'test.jpg');

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });
    const { id: imageId } = uploadRes.json();

    const res = await app.inject({
      method: 'DELETE',
      url: `/listings/${listingId}/images/${imageId}`,
      headers: { authorization: `Bearer ${otherUserToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  // ── Replace (delete + upload) ─────────────────────────────────────────────

  it('replaces an image (delete old + upload new) end-to-end', async () => {
    // Upload JPEG
    const jpeg = await makeJpeg();
    const form1 = new FormData();
    form1.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'test.jpg');

    const upload1 = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form1,
    });
    const { id: oldImageId, storage_key: oldKey } = upload1.json();

    // Delete old
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/listings/${listingId}/images/${oldImageId}`,
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    // Upload PNG replacement
    const png = await makePng();
    const form2 = new FormData();
    form2.append('file', new Blob([png], { type: 'image/png' }), 'replacement.png');

    const upload2 = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form2,
    });

    expect(upload2.statusCode).toBe(201);
    const newImage = upload2.json();
    expect(newImage.storage_key).not.toBe(oldKey);
    expect(newImage.storage_key).toMatch(/\.png$/);
  });

  // ── Listing detail returns storage_key ────────────────────────────────────

  it('listing detail includes image storage_key after upload', async () => {
    const jpeg = await makeJpeg();
    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'test.jpg');

    await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/listings/${listingId}`,
    });

    expect(res.statusCode).toBe(200);
    const listing = res.json();
    expect(listing.images).toBeInstanceOf(Array);
    expect(listing.images.length).toBe(1);
    expect(listing.images[0].storage_key).toMatch(/^listings\/.+\.jpg$/);
  });

  // ── Max 5 images ──────────────────────────────────────────────────────────

  it('rejects more than 5 images per listing', async () => {
    const jpeg = await makeJpeg();

    // Upload 5 images
    for (let i = 0; i < 5; i++) {
      const form = new FormData();
      form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), `img${i}.jpg`);
      const res = await app.inject({
        method: 'POST',
        url: `/listings/${listingId}/images`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: form,
      });
      expect(res.statusCode).toBe(201);
    }

    // 6th upload should fail
    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'extra.jpg');
    const res = await app.inject({
      method: 'POST',
      url: `/listings/${listingId}/images`,
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/maximum 5/i);
  });
});

// ── Avatar Integration Tests ──────────────────────────────────────────────

describe('MinIO Integration — Avatar', () => {
  let app: FastifyInstance;
  let userId: string;
  let userNickname: string;
  let userToken: string;

  async function makeJpeg(): Promise<Buffer> {
    return sharp({ create: { width: 10, height: 10, channels: 3, background: '#ff0000' } })
      .jpeg({ quality: 85 })
      .toBuffer();
  }

  beforeAll(async () => {
    app = await buildApp({ skipRateLimit: true });
    await app.ready();

    const suffix = `avatar_${Date.now()}`;
    const user = await app.pg.query(
      `INSERT INTO users (nickname, password_hash, bio, email_verified)
       VALUES ($1, 'hash', '', TRUE) RETURNING id, nickname`,
      [`miniotest_avatar_${suffix}`],
    );
    userId = user.rows[0].id;
    userNickname = user.rows[0].nickname;
    await app.pg.query('INSERT INTO reputation_scores (user_id) VALUES ($1)', [userId]);
    userToken = await signAccessToken({ sub: userId, nickname: userNickname });
  });

  afterAll(async () => {
    // Clean up avatar from MinIO
    try {
      const stream = app.minio.listObjects(app.minioBucket, `avatars/${userId}`, true);
      for await (const obj of stream) {
        if (obj.name) await app.minio.removeObject(app.minioBucket, obj.name);
      }
    } catch { /* ignore */ }

    await app.pg.query("DELETE FROM reputation_scores WHERE user_id IN (SELECT id FROM users WHERE nickname LIKE 'miniotest_avatar_%')");
    await app.pg.query("DELETE FROM users WHERE nickname LIKE 'miniotest_avatar_%'");
    await app.close();
  });

  it('uploads avatar and serves it via GET', async () => {
    const jpeg = await makeJpeg();

    const form = new FormData();
    form.append('file', new Blob([jpeg], { type: 'image/jpeg' }), 'avatar.jpg');

    const uploadRes = await app.inject({
      method: 'PUT',
      url: '/users/me/avatar',
      headers: { authorization: `Bearer ${userToken}` },
      payload: form,
    });

    expect(uploadRes.statusCode).toBe(200);
    expect(uploadRes.json().avatar_key).toMatch(/^avatars\//);

    // Serve it back
    const getRes = await app.inject({
      method: 'GET',
      url: `/users/${userNickname}/avatar`,
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.headers['content-type']).toBe('image/jpeg');
  });

  it('replaces old avatar when uploading a new one', async () => {
    const jpeg1 = await makeJpeg();
    const form1 = new FormData();
    form1.append('file', new Blob([jpeg1], { type: 'image/jpeg' }), 'avatar1.jpg');

    const res1 = await app.inject({
      method: 'PUT',
      url: '/users/me/avatar',
      headers: { authorization: `Bearer ${userToken}` },
      payload: form1,
    });
    const oldKey = res1.json().avatar_key;

    const jpeg2 = await makeJpeg();
    const form2 = new FormData();
    form2.append('file', new Blob([jpeg2], { type: 'image/jpeg' }), 'avatar2.jpg');

    const res2 = await app.inject({
      method: 'PUT',
      url: '/users/me/avatar',
      headers: { authorization: `Bearer ${userToken}` },
      payload: form2,
    });

    expect(res2.statusCode).toBe(200);
    const newKey = res2.json().avatar_key;
    expect(newKey).not.toBe(oldKey);

    // Old key should be gone from MinIO
    try {
      await app.minio.statObject(app.minioBucket, oldKey);
      expect.fail('Old avatar should have been deleted');
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe('NotFound');
    }
  });
});
