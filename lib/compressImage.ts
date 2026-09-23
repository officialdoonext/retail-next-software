import sharp, { Metadata } from "sharp";

export interface CompressionResult {
  buffer: Buffer;
  format: string;
  size: number;
}

/**
 * Compresses any image buffer to a target maximum size (default 60KB / 61,440 bytes)
 * while preserving high visual quality.
 *
 * Strategy:
 * 1. Read metadata (dimensions, format).
 * 2. If it's already an image <= 60KB, return directly or lightly optimize.
 * 3. Use WebP (or adaptive JPEG for legacy fallbacks) which delivers superior
 *    visual fidelity at smaller byte budgets compared to PNG/JPEG.
 * 4. Scale down max dimensions gracefully (e.g. from 4000px camera photos to 1200px/1000px,
 *    which retains 100% crisp retina-display quality on web screens).
 * 5. Iteratively scale quality/dimensions until size <= maxBytes.
 */
export async function compressImageToTargetSize(
  inputBuffer: Buffer,
  maxBytes: number = 60 * 1024
): Promise<CompressionResult> {
  let meta: Metadata;
  try {
    meta = await sharp(inputBuffer).metadata();
  } catch (err) {
    // If not a standard raster image (e.g. svg, non-image), return as-is
    return {
      buffer: inputBuffer,
      format: "unknown",
      size: inputBuffer.length,
    };
  }

  // If already under maxBytes and is already compressed (e.g. webp/jpeg <= 60KB), return as is
  if (inputBuffer.length <= maxBytes && (meta.format === "webp" || meta.format === "jpeg" || meta.format === "png")) {
    return {
      buffer: inputBuffer,
      format: meta.format,
      size: inputBuffer.length,
    };
  }

  // Starting dimensions: cap max dimension to 1200px to maintain crisp clarity without bloating bytes
  const origW = meta.width || 800;
  const origH = meta.height || 800;
  let maxDim = Math.min(1200, Math.max(origW, origH));
  let quality = 85;

  let current = await sharp(inputBuffer)
    .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();

  if (current.length <= maxBytes) {
    return {
      buffer: current,
      format: "webp",
      size: current.length,
    };
  }

  // Iterative binary-step reduction until <= maxBytes
  let attempts = 0;
  while (current.length > maxBytes && attempts < 10 && (quality > 25 || maxDim > 240)) {
    attempts++;
    if (quality > 50) {
      quality -= 10;
    } else if (maxDim > 450) {
      maxDim = Math.round(maxDim * 0.78);
      quality = 75; // reset quality slightly for smaller dimension to maintain clarity
    } else {
      quality -= 5;
      maxDim = Math.round(maxDim * 0.85);
    }

    current = await sharp(inputBuffer)
      .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer();
  }

  return {
    buffer: current,
    format: "webp",
    size: current.length,
  };
}
