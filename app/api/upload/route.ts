import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import imagekit from "@/lib/imagekit";
import { compressImageToTargetSize } from "@/lib/compressImage";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

    if (!token || !storeId) {
      return NextResponse.json({ success: false, error: "Unauthorized access." }, { status: 401 });
    }

    const session = await verifySessionToken(token);
    if (!session) {
      return NextResponse.json({ success: false, error: "Invalid session." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided for upload." }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const rawBuffer = Buffer.from(arrayBuffer);

    // Compress image to <= 60KB without losing quality
    const { buffer: compressedBuffer, format, size } = await compressImageToTargetSize(rawBuffer, 60 * 1024);
    console.log(`[Upload] Image compressed: Original ${rawBuffer.length} bytes -> ${size} bytes (${(size / 1024).toFixed(1)} KB)`);

    // Sanitize file name
    const ext = format === "webp" ? ".webp" : format === "jpeg" ? ".jpg" : "";
    const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9.-]/g, "_");
    const cleanFileName = `${storeId}_${Date.now()}_${baseName}${ext || ".webp"}`;
    const subfolder = String(formData.get("folder") || "general").replace(/[^a-zA-Z0-9_-]/g, "");

    // Upload compressed buffer to ImageKit
    const uploadResponse = await imagekit.upload({
      file: compressedBuffer,
      fileName: cleanFileName,
      folder: `/retailnext/${storeId}/${subfolder}`,
      useUniqueFileName: true,
    });

    return NextResponse.json({
      success: true,
      url: uploadResponse.url,
      thumbnailUrl: uploadResponse.thumbnailUrl || uploadResponse.url,
      fileId: uploadResponse.fileId,
    });
  } catch (error: any) {
    console.error("Error uploading to ImageKit:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to upload image." },
      { status: 500 }
    );
  }
}
