import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
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

    const { buffer: compressedQrBuffer } = await compressImageToTargetSize(qrRawBuffer, 60 * 1024);

    const uploadRes = await imagekit.upload({
      file: compressedQrBuffer,
      fileName: `qr_${storeId}_${employeeId}.png`,
      folder: `/retailnext/${storeId}/employees/qrcodes`,
      useUniqueFileName: true,
    });

    return uploadRes.url || "";
  } catch (err) {
    console.error(`Failed to generate/upload QR for ${employeeId}:`, err);
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawList = body.employees;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { success: false, error: "No employee data provided for bulk upload." },
        { status: 400 }
      );
    }

    // 1. Fetch existing employees for the active store to avoid duplicate mobiles / IDs
    const empRef = collection(db, "employees");
    const q = query(empRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    const existingMobiles = new Set<string>();
    const existingIds = new Set<string>();
    let maxIdNum = 1000000;

    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.mobile) existingMobiles.add(String(data.mobile));
      if (data.employeeId) {
        const idStr = String(data.employeeId);
        existingIds.add(idStr);
        const num = parseInt(idStr, 10);
        if (!isNaN(num) && num > maxIdNum && num < 9999999) {
          maxIdNum = num;
        }
      }
    });

    let nextAvailableId = maxIdNum + 1;
    const generateNextId = () => {
      while (existingIds.has(String(nextAvailableId))) {
        nextAvailableId++;
      }
      const assigned = String(nextAvailableId);
      existingIds.add(assigned);
      nextAvailableId++;
      return assigned;
    };

    const savedEmployees: any[] = [];
    const skippedDuplicates: string[] = [];

    // Process employees in controlled batches of 5 to avoid overloading ImageKit concurrent connections
    const CHUNK_SIZE = 5;
    for (let i = 0; i < rawList.length; i += CHUNK_SIZE) {
      const chunk = rawList.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async (row: any) => {
          const name = String(row.name || row["Employee Name"] || row.Name || "").trim();
          const rawMobile = String(row.mobile || row["Mobile Number"] || row.Mobile || "").replace(/\D/g, "");
          const city = String(row.city || row["City"] || row.City || "").trim() || "Local";
          const address = String(row.address || row["Full Address"] || row.Address || "").trim() || `${city}, Store Branch`;
          const email = String(row.email || row["Email"] || row.Email || "").trim().toLowerCase();
          const avatarUrl = String(row.avatarUrl || row["Image URL"] || row.imageUrl || "").trim();

          const salaryTypeRaw = String(row.salaryType || row["Salary Type"] || row.SalaryType || "").toLowerCase();
          const salaryType: "monthly" | "daily" = salaryTypeRaw.includes("day") || salaryTypeRaw.includes("daily") ? "daily" : "monthly";

          const rawAmount = Number(row.salaryAmount || row["Salary Amount (INR)"] || row.salary || row.Salary || 0);
          const salaryAmount = rawAmount > 0 ? rawAmount : (salaryType === "monthly" ? 20000 : 700);

          const acceptedLeaves = Math.max(0, parseInt(String(row["Accepted Leaves"] ?? row.acceptedLeaves ?? 0), 10) || 0);

          const emergencyName = String(row.emergencyName || row["Emergency Contact Name"] || row.EmergencyName || "").trim() || "Family Contact";
          const emergencyRelation = String(row.emergencyRelation || row["Emergency Contact Relation"] || row.EmergencyRelation || "").trim() || "Spouse";
          const rawEcMobile = String(row.emergencyContactNumber || row["Emergency Contact Number"] || row.EmergencyContact || "").replace(/\D/g, "");
          const emergencyContactNumber = rawEcMobile.length >= 10 ? rawEcMobile.slice(-10) : "9876543210";

          if (!name || rawMobile.length < 10) {
            return; // Skip invalid entries
          }

          const cleanMobile = rawMobile.slice(-10);
          if (existingMobiles.has(cleanMobile)) {
            skippedDuplicates.push(`${name} (${cleanMobile})`);
            return;
          }
          existingMobiles.add(cleanMobile);

          // Assign unique 7-digit numeric Employee ID
          let employeeId = String(row.employeeId || row["Employee ID"] || "").trim();
          if (!employeeId || !/^\d{7}$/.test(employeeId) || existingIds.has(employeeId)) {
            employeeId = generateNextId();
          } else {
            existingIds.add(employeeId);
          }

          // Generate & upload ImageKit QR code for StoreID/EmployeeID
          const qrCodeUrl = await generateAndUploadEmployeeQr(ctx.storeId, employeeId);

          const payload = {
            storeId: ctx.storeId,
            employeeId,
            name,
            avatarUrl: avatarUrl || "", // If empty, first letter identification is used in UI
            qrCodeUrl: qrCodeUrl || "",
            mobile: cleanMobile,
            city,
            address,
            email,
            salaryType,
            salaryAmount,
            acceptedLeaves,
            emergencyContactNumber,
            emergencyRelation,
            emergencyName,
            status: "Active",
            createdBy: ctx.session.email,
            createdAt: Date.now(),
          };

          const docRef = await addDoc(empRef, payload);
          savedEmployees.push({ id: docRef.id, ...payload });
        })
      );
    }

    return NextResponse.json({
      success: true,
      count: savedEmployees.length,
      skippedCount: skippedDuplicates.length,
      skippedDuplicates,
      employees: savedEmployees,
    });
  } catch (err: any) {
    console.error("Bulk upload error in /api/employees/bulk:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to process bulk employee upload." },
      { status: 500 }
    );
  }
}
