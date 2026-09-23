import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import QRCode from "qrcode";
import imagekit from "@/lib/imagekit";
import { compressImageToTargetSize } from "@/lib/compressImage";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;
  if (!token || !storeId) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return { session, storeId };
}

/**
 * Generate a unique 7-digit numeric employee ID for the store (e.g. 1000001, 1000002...)
 */
async function generateUnique7DigitEmployeeId(storeId: string): Promise<string> {
  const empRef = collection(db, "employees");
  const q = query(empRef, where("storeId", "==", storeId));
  const snap = await getDocs(q);
  const existingIds = new Set<string>();
  snap.forEach((d) => {
    const data = d.data();
    if (data.employeeId) {
      existingIds.add(String(data.employeeId));
    }
  });

  let candidate = 1000001;
  while (existingIds.has(String(candidate))) {
    candidate++;
  }
  return String(candidate);
}

/**
 * Generates a QR code image for StoreID/EmployeeID, compresses to <= 60KB,
 * and uploads to ImageKit.
 */
async function generateAndUploadEmployeeQr(storeId: string, employeeId: string): Promise<string> {
  try {
    const qrContent = `${storeId}/${employeeId}`;
    const qrRawBuffer = await QRCode.toBuffer(qrContent, {
      width: 480,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    });

    // Compress to <= 60KB
    const { buffer: compressedQrBuffer } = await compressImageToTargetSize(qrRawBuffer, 60 * 1024);

    // Upload to ImageKit
    const uploadRes = await imagekit.upload({
      file: compressedQrBuffer,
      fileName: `qr_${storeId}_${employeeId}.png`,
      folder: `/retailnext/${storeId}/employees/qrcodes`,
      useUniqueFileName: true,
    });

    return uploadRes.url || "";
  } catch (err) {
    console.error("Error generating/uploading employee QR code:", err);
    return "";
  }
}

// GET /api/employees: Fetch list of employees for the active store
export async function GET() {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const empRef = collection(db, "employees");
    const q = query(empRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const employees = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, employees });
  } catch (err: any) {
    console.error("GET /api/employees error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch employees." },
      { status: 500 }
    );
  }
}

// POST – add a new employee
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx)
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );

    const body = await request.json();

    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const address = String(body.address || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const avatarUrl = String(body.avatarUrl || "").trim();
    const salaryType = body.salaryType === "daily" ? "daily" : "monthly";
    const salaryAmount = Number(body.salaryAmount) || 0;
    const emergencyContactNumber = String(body.emergencyContactNumber || "").trim().replace(/\D/g, "");
    const emergencyRelation = String(body.emergencyRelation || "").trim();
    const emergencyName = String(body.emergencyName || "").trim();

    if (!name)
      return NextResponse.json({ success: false, error: "Employee name is required." }, { status: 400 });
    if (!mobile || mobile.length < 10)
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    if (!city)
      return NextResponse.json({ success: false, error: "City is required." }, { status: 400 });
    if (!address)
      return NextResponse.json({ success: false, error: "Full address is required." }, { status: 400 });
    if (salaryAmount <= 0)
      return NextResponse.json({ success: false, error: "Please enter a valid salary / wage amount." }, { status: 400 });
    if (!emergencyContactNumber || emergencyContactNumber.length < 10)
      return NextResponse.json({ success: false, error: "Emergency contact number must be 10 digits." }, { status: 400 });
    if (!emergencyRelation)
      return NextResponse.json({ success: false, error: "Emergency contact relation is required." }, { status: 400 });
    if (!emergencyName)
      return NextResponse.json({ success: false, error: "Emergency contact name is required." }, { status: 400 });

    const empRef = collection(db, "employees");

    // 7-digit numeric Employee ID handling
    let finalEmployeeId = String(body.employeeId || "").trim();
    if (finalEmployeeId) {
      if (!/^\d{7}$/.test(finalEmployeeId)) {
        return NextResponse.json(
          { success: false, error: "Employee ID must be a unique 7-digit numeric number." },
          { status: 400 }
        );
      }
      // Check collision for provided employeeId
      const idQ = query(empRef, where("storeId", "==", ctx.storeId), where("employeeId", "==", finalEmployeeId));
      const idSnap = await getDocs(idQ);
      if (!idSnap.empty) {
        return NextResponse.json(
          { success: false, error: `Employee ID ${finalEmployeeId} already exists in this store.` },
          { status: 409 }
        );
      }
    } else {
      finalEmployeeId = await generateUnique7DigitEmployeeId(ctx.storeId);
    }

    // Duplicate mobile check in same store
    const dupQ = query(empRef, where("storeId", "==", ctx.storeId), where("mobile", "==", mobile));
    const dupSnap = await getDocs(dupQ);
    if (!dupSnap.empty)
      return NextResponse.json(
        { success: false, error: `An employee with mobile ${mobile} already exists.` },
        { status: 409 }
      );

    // Generate StoreID/EmployeeID QR code, compress to <= 60KB, and upload to ImageKit
    const qrCodeUrl = await generateAndUploadEmployeeQr(ctx.storeId, finalEmployeeId);

    const payload = {
      storeId: ctx.storeId,
      employeeId: finalEmployeeId,
      name,
      avatarUrl: avatarUrl || "",
      qrCodeUrl: qrCodeUrl || "",
      mobile,
      city,
      address,
      email,
      salaryType,
      salaryAmount,
      emergencyContactNumber,
      emergencyRelation,
      emergencyName,
      status: "Active",
      createdBy: ctx.session.email,
      createdAt: Date.now(),
    };

    const docRef = await addDoc(empRef, payload);
    return NextResponse.json({ success: true, employee: { id: docRef.id, ...payload } });
  } catch (err) {
    console.error("POST /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to add employee." }, { status: 500 });
  }
}

// PUT – update an existing employee
export async function PUT(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx)
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id)
      return NextResponse.json({ success: false, error: "Employee ID is required." }, { status: 400 });

    const empDocRef = doc(db, "employees", id);
    const empSnap = await getDoc(empDocRef);
    if (!empSnap.exists() || empSnap.data().storeId !== ctx.storeId)
      return NextResponse.json({ success: false, error: "Employee not found." }, { status: 404 });

    const name = String(body.name || "").trim();
    const mobile = String(body.mobile || "").trim().replace(/\D/g, "");
    const city = String(body.city || "").trim();
    const address = String(body.address || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const salaryType = body.salaryType === "daily" ? "daily" : "monthly";
    const salaryAmount = Number(body.salaryAmount) || 0;
    const emergencyContactNumber = String(body.emergencyContactNumber || "").trim().replace(/\D/g, "");
    const emergencyRelation = String(body.emergencyRelation || "").trim();
    const emergencyName = String(body.emergencyName || "").trim();

    if (!name)
      return NextResponse.json({ success: false, error: "Employee name is required." }, { status: 400 });
    if (!mobile || mobile.length < 10)
      return NextResponse.json({ success: false, error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
    if (!city)
      return NextResponse.json({ success: false, error: "City is required." }, { status: 400 });
    if (!address)
      return NextResponse.json({ success: false, error: "Full address is required." }, { status: 400 });
    if (salaryAmount <= 0)
      return NextResponse.json({ success: false, error: "Please enter a valid salary / wage amount." }, { status: 400 });
    if (!emergencyContactNumber || emergencyContactNumber.length < 10)
      return NextResponse.json({ success: false, error: "Emergency contact number must be 10 digits." }, { status: 400 });
    if (!emergencyRelation)
      return NextResponse.json({ success: false, error: "Emergency contact relation is required." }, { status: 400 });
    if (!emergencyName)
      return NextResponse.json({ success: false, error: "Emergency contact name is required." }, { status: 400 });

    // Duplicate mobile in same store (excluding self)
    const empRef = collection(db, "employees");
    const dupQ = query(empRef, where("storeId", "==", ctx.storeId), where("mobile", "==", mobile));
    const dupSnap = await getDocs(dupQ);
    if (dupSnap.docs.some((d) => d.id !== id))
      return NextResponse.json(
        { success: false, error: `Another employee already has mobile ${mobile}.` },
        { status: 409 }
      );

    const existingData = empSnap.data();
    let employeeId = existingData.employeeId;
    if (!employeeId) {
      employeeId = await generateUnique7DigitEmployeeId(ctx.storeId);
    }

    let qrCodeUrl = existingData.qrCodeUrl;
    if (!qrCodeUrl) {
      qrCodeUrl = await generateAndUploadEmployeeQr(ctx.storeId, employeeId);
    }

    const updatePayload: Record<string, any> = {
      name,
      mobile,
      city,
      address,
      email,
      salaryType,
      salaryAmount,
      emergencyContactNumber,
      emergencyRelation,
      emergencyName,
      employeeId,
      qrCodeUrl: qrCodeUrl || "",
      updatedAt: Date.now(),
    };

    if (body.avatarUrl !== undefined) {
      updatePayload.avatarUrl = String(body.avatarUrl || "").trim();
    }

    await updateDoc(empDocRef, updatePayload);
    return NextResponse.json({ success: true, employee: { id, ...existingData, ...updatePayload } });
  } catch (err) {
    console.error("PUT /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to update employee." }, { status: 500 });
  }
}

// DELETE – remove an employee
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx)
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id)
      return NextResponse.json({ success: false, error: "Employee ID is required." }, { status: 400 });

    const empDocRef = doc(db, "employees", id);
    const empSnap = await getDoc(empDocRef);
    if (!empSnap.exists() || empSnap.data().storeId !== ctx.storeId)
      return NextResponse.json({ success: false, error: "Employee not found." }, { status: 404 });

    await deleteDoc(empDocRef);
    return NextResponse.json({ success: true, message: "Employee deleted." });
  } catch (err) {
    console.error("DELETE /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete employee." }, { status: 500 });
  }
}
