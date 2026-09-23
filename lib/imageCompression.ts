/**
 * Client-side image compression to <= 60KB (61,440 bytes)
 * Uses HTML5 Canvas with adaptive dimension resizing and quality iteration
 * so image uploads are fast, responsive, and visually crisp.
 */
export async function compressClientImage(
  file: File,
  maxBytes: number = 60 * 1024
): Promise<File> {
  // If the file is already under maxBytes and is an image, we can return it directly
  if (file.size <= maxBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to parse image element."));
      img.onload = async () => {
        try {
          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;

          // Start with max dimension 1000px
          let maxDim = Math.min(1000, Math.max(origW, origH));
          let quality = 0.85;

          const getCanvasBlob = (w: number, h: number, q: number): Promise<Blob | null> => {
            const canvas = document.createElement("canvas");
            let targetW = w;
            let targetH = h;
            if (origW > origH) {
              targetW = maxDim;
              targetH = Math.round((origH / origW) * maxDim);
            } else {
              targetH = maxDim;
              targetW = Math.round((origW / origH) * maxDim);
            }
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext("2d");
            if (!ctx) return Promise.resolve(null);

            // High quality smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, targetW, targetH);

            return new Promise((res) => {
              canvas.toBlob((blob) => res(blob), "image/webp", q);
            });
          };

          let blob = await getCanvasBlob(origW, origH, quality);

          // If webp is not supported or null, try jpeg
          if (!blob) {
            const canvas = document.createElement("canvas");
            canvas.width = Math.min(800, origW);
            canvas.height = Math.round((origH / origW) * canvas.width);
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            blob = await new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.8));
          }

          let attempts = 0;
          while (blob && blob.size > maxBytes && attempts < 8 && (quality > 0.3 || maxDim > 300)) {
            attempts++;
            if (quality > 0.5) {
              quality -= 0.12;
            } else if (maxDim > 450) {
              maxDim = Math.round(maxDim * 0.78);
              quality = 0.75;
            } else {
              quality -= 0.08;
              maxDim = Math.round(maxDim * 0.85);
            }
            const nextBlob = await getCanvasBlob(origW, origH, quality);
            if (nextBlob) blob = nextBlob;
          }

          if (!blob) {
            return resolve(file);
          }

          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const compressedFile = new File([blob], `${baseName}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          });

          resolve(compressedFile);
        } catch (err) {
          console.warn("Client image compression fallback:", err);
          resolve(file);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
