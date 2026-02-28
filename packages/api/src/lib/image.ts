import sharp from 'sharp';

// ── Magic bytes for supported image types ─────────────────────────────────────
// We validate the actual file bytes, not the Content-Type header or file extension.

const MAGIC_BYTES: Array<{ signature: number[]; mime: string }> = [
  { signature: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },          // JPEG/JPG
  { signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' }, // PNG
  { signature: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp' },    // RIFF … (WebP starts with RIFF)
];

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Detects the actual image type from raw file bytes.
 * Returns the MIME type if the magic bytes match a supported format, null otherwise.
 */
export function detectImageMime(buffer: Buffer): string | null {
  for (const { signature, mime } of MAGIC_BYTES) {
    if (buffer.length >= signature.length) {
      const matches = signature.every((byte, i) => buffer[i] === byte);
      if (matches) {
        // Extra check for WebP: bytes 8-11 must be "WEBP"
        if (mime === 'image/webp') {
          if (buffer.length < 12) return null;
          const webpMarker = buffer.slice(8, 12).toString('ascii');
          if (webpMarker !== 'WEBP') return null;
        }
        return mime;
      }
    }
  }
  return null;
}

/**
 * Strips EXIF and all metadata from an image buffer using sharp.
 * Re-encodes to the same format (JPEG/PNG/WebP) with quality 85.
 * Returns the processed buffer and its MIME type.
 */
export async function processImage(
  inputBuffer: Buffer,
  _declaredMime?: string,
): Promise<{ buffer: Buffer; mime: string }> {
  // Detect actual image type from magic bytes — ignore declared MIME since browsers
  // are inconsistent (e.g. image/jpg vs image/jpeg, or octet-stream for valid images).
  const detectedMime = detectImageMime(inputBuffer);
  if (!detectedMime || !ALLOWED_MIMES.has(detectedMime)) {
    throw new Error('Invalid image format: file bytes do not match a supported image type');
  }

  const image = sharp(inputBuffer, { failOn: 'error' });

  // Strip all metadata (EXIF, GPS, ICC profile, etc.) by NOT calling withMetadata().
  // Sharp strips metadata by default when re-encoding.
  let outputBuffer: Buffer;
  switch (detectedMime) {
    case 'image/jpeg':
      outputBuffer = await image.jpeg({ quality: 85 }).toBuffer();
      break;
    case 'image/png':
      outputBuffer = await image.png({ compressionLevel: 7 }).toBuffer();
      break;
    case 'image/webp':
      outputBuffer = await image.webp({ quality: 85 }).toBuffer();
      break;
    default:
      throw new Error(`Unsupported MIME: ${detectedMime}`);
  }

  return { buffer: outputBuffer, mime: detectedMime };
}
