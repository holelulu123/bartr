import { describe, it, expect } from 'vitest';
import { detectImageMime, processImage } from '../lib/image.js';
import sharp from 'sharp';

// ── detectImageMime ────────────────────────────────────────────────────────────

describe('detectImageMime', () => {
  it('detects JPEG by magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectImageMime(buf)).toBe('image/jpeg');
  });

  it('detects PNG by magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageMime(buf)).toBe('image/png');
  });

  it('detects WebP by RIFF + WEBP marker', () => {
    // RIFF????WEBP
    const buf = Buffer.alloc(12);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46; // RIFF
    buf[4] = 0x00; buf[5] = 0x00; buf[6] = 0x00; buf[7] = 0x00; // file size
    buf[8] = 0x57; buf[9] = 0x45; buf[10] = 0x42; buf[11] = 0x50; // WEBP
    expect(detectImageMime(buf)).toBe('image/webp');
  });

  it('returns null for RIFF without WEBP marker', () => {
    const buf = Buffer.alloc(12);
    buf[0] = 0x52; buf[1] = 0x49; buf[2] = 0x46; buf[3] = 0x46;
    buf.write('AVI ', 8, 'ascii');
    expect(detectImageMime(buf)).toBeNull();
  });

  it('returns null for random bytes', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(detectImageMime(buf)).toBeNull();
  });

  it('returns null for empty buffer', () => {
    expect(detectImageMime(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for too-short JPEG buffer', () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

// ── processImage ──────────────────────────────────────────────────────────────

async function makeJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } } })
    .jpeg()
    .toBuffer();
}

async function makePng(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } } })
    .png()
    .toBuffer();
}

async function makeWebp(): Promise<Buffer> {
  return sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 255 } } })
    .webp()
    .toBuffer();
}

describe('processImage', () => {
  it('accepts and processes a valid JPEG', async () => {
    const input = await makeJpeg();
    const { buffer, mime } = await processImage(input, 'image/jpeg');
    expect(mime).toBe('image/jpeg');
    expect(buffer.length).toBeGreaterThan(0);
    // Verify output is still a valid JPEG
    expect(detectImageMime(buffer)).toBe('image/jpeg');
  });

  it('accepts and processes a valid PNG', async () => {
    const input = await makePng();
    const { buffer, mime } = await processImage(input, 'image/png');
    expect(mime).toBe('image/png');
    expect(detectImageMime(buffer)).toBe('image/png');
  });

  it('accepts and processes a valid WebP', async () => {
    const input = await makeWebp();
    const { buffer, mime } = await processImage(input, 'image/webp');
    expect(mime).toBe('image/webp');
    expect(detectImageMime(buffer)).toBe('image/webp');
  });

  it('throws when declared MIME does not match file bytes', async () => {
    const jpeg = await makeJpeg();
    await expect(processImage(jpeg, 'image/png')).rejects.toThrow(/mismatch/i);
  });

  it('throws for non-image buffer', async () => {
    const garbage = Buffer.from('this is not an image at all');
    await expect(processImage(garbage, 'image/jpeg')).rejects.toThrow(/invalid image format/i);
  });

  it('throws for empty buffer', async () => {
    await expect(processImage(Buffer.alloc(0), 'image/jpeg')).rejects.toThrow();
  });
});
