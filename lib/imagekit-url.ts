/**
 * Helper utility to generate optimized ImageKit CDN URLs.
 * 
 * ImageKit URLs support on-the-fly transformations via query parameters:
 * e.g., https://ik.imagekit.io/doonext/path/image.webp?tr=w-100,h-100,q-80,fo-auto
 * 
 * This ensures that a 2-5 MB original image is transformed into a tiny 5-15 KB thumbnail
 * for table listings and POS grids.
 */

interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number;
  cropMode?: "pad_resize" | "maintain_ratio" | "force" | "at_max";
  format?: "auto" | "webp" | "jpg" | "png";
}

export function getImageKitThumbnail(
  url?: string | null,
  options: ImageTransformOptions = { width: 100, height: 100, quality: 80 }
): string {
  if (!url) return "";

  // If not an ImageKit URL, return original
  if (!url.includes("imagekit.io")) {
    return url;
  }

  const { width = 100, height = 100, quality = 80, cropMode = "maintain_ratio", format = "auto" } = options;

  const transformations: string[] = [];
  if (width) transformations.push(`w-${width}`);
  if (height) transformations.push(`h-${height}`);
  if (quality) transformations.push(`q-${quality}`);
  if (cropMode) transformations.push(`cm-${cropMode}`);
  if (format) transformations.push(`f-${format}`);

  const transformString = `tr=${transformations.join(",")}`;

  // If URL already has query parameters
  if (url.includes("?")) {
    // If it already has tr=, don't double append
    if (url.includes("tr=")) {
      return url;
    }
    return `${url}&${transformString}`;
  }

  return `${url}?${transformString}`;
}
