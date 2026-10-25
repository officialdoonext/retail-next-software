import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";
import QRCode from "qrcode";
import imagekit from "@/lib/imagekit";
import { compressImageToTargetSize } from "@/lib/compressImage";

const DEFAULT_EMPLOYEE_AVATAR = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80";

async function generateAndUploadEmployeeQr(businessId: string, employeeId: string): Promise<string> {
  try {
    const qrContent = `${businessId}:${employeeId}`;
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
      fileName: `qr_${businessId}_${employeeId}.png`,
      folder: `/retailnext/${businessId}/employees/qrcodes`,
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
    const ctx = await getBusinessContext();
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

    // Fetch existing employees to prevent duplicate mobile / IDs
    const { data: existingRows } = await ctx.supabase
      .from("employees")
      .select("mobile, employee_id")
      .eq("business_id", ctx.businessId);

    const existingMobiles = new Set<string>();
    const existingIds = new Set<string>();
    let maxIdNum = 1000000;

    (existingRows || []).forEach((row: any) => {
      if (row.mobile) existingMobiles.add(String(row.mobile));
      if (row.employee_id) {
        const idStr = String(row.employee_id);
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
            return;
          }

          const cleanMobile = rawMobile.slice(-10);
          if (existingMobiles.has(cleanMobile)) {
            skippedDuplicates.push(`${name} (${cleanMobile})`);
            return;
          }
          existingMobiles.add(cleanMobile);

          // Employee ID is always auto-generated, numeric, unique, non-editable
          const employeeId = generateNextId();

          const qrCodeUrl = await generateAndUploadEmployeeQr(ctx.businessId, employeeId);

          const payload = {
            business_id: ctx.businessId,
            store_id: ctx.storeId || null,
            employee_id: employeeId,
            name,
            avatar_url: avatarUrl || DEFAULT_EMPLOYEE_AVATAR,
            qr_code_url: qrCodeUrl || "",
            mobile: cleanMobile,
            city,
            address,
            email,
            salary_type: salaryType,
            salary_amount: salaryAmount,
            accepted_leaves: acceptedLeaves,
            emergency_contact_number: emergencyContactNumber,
            emergency_relation: emergencyRelation,
            emergency_name: emergencyName,
            status: "Active",
            created_by: ctx.session.email || "system",
          };

          const { data: inserted } = await ctx.supabase
            .from("employees")
            .insert(payload)
            .select()
            .single();

          if (inserted) {
            savedEmployees.push({ id: inserted.id, ...payload });
          }
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
