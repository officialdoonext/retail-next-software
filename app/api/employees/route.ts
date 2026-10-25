import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";
import QRCode from "qrcode";
import imagekit from "@/lib/imagekit";
import { compressImageToTargetSize } from "@/lib/compressImage";

/**
 * Generate a unique 7-digit numeric employee ID for the store (e.g. 1000001, 1000002...)
 */
async function generateUnique7DigitEmployeeId(supabase: any, businessId: string): Promise<string> {
  const { data } = await supabase
    .from("employees")
    .select("employee_id")
    .eq("business_id", businessId);

  const existingIds = new Set<string>();
  (data || []).forEach((row: any) => {
    if (row.employee_id) existingIds.add(String(row.employee_id));
  });

  let candidate = 1000001;
  while (existingIds.has(String(candidate))) {
    candidate++;
  }
  return String(candidate);
}

/**
 * Generates a QR code image for businessId:employeeId (for attendance scanning),
 * compresses to <= 60KB, and uploads to ImageKit.
 */
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
    console.error("Error generating/uploading employee QR code:", err);
    return "";
  }
}

// GET /api/employees: Fetch list of employees for the active store with search & 24-item pagination
export async function GET(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active business." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fetchAll = searchParams.get("all") === "true";
    const searchQuery = searchParams.get("search")?.trim().toLowerCase() || "";
    const cityFilter = searchParams.get("city")?.trim() || "";
    const salaryTypeFilter = searchParams.get("salaryType")?.trim() || "";
    const statusFilter = searchParams.get("status")?.trim() || "";

    let query = ctx.supabase
      .from("employees")
      .select("*")
      .eq("business_id", ctx.businessId);

    if (ctx.storeId) {
      query = query.or(`store_id.eq.${ctx.storeId},store_id.is.null`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let employees = (data || []).map((row: any) => {
      let addressText = row.address || "";
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (addressText && typeof addressText === "string" && addressText.startsWith("{")) {
        try {
          const parsed = JSON.parse(addressText);
          if (parsed && typeof parsed === "object") {
            addressText = parsed.addressText || parsed.address || "";
            latitude = parsed.latitude !== undefined && parsed.latitude !== null ? Number(parsed.latitude) : null;
            longitude = parsed.longitude !== undefined && parsed.longitude !== null ? Number(parsed.longitude) : null;
          }
        } catch {}
      }

      return {
        id: row.id,
        storeId: row.store_id,
        employeeId: row.employee_id,
        name: row.name,
        mobile: row.mobile,
        city: row.city,
        address: addressText,
        latitude,
        longitude,
        email: row.email || "",
        salaryType: row.salary_type || "monthly",
        salaryAmount: Number(row.salary_amount) || 0,
        acceptedLeaves: row.accepted_leaves || 0,
        emergencyContactNumber: row.emergency_contact_number || "",
        emergencyRelation: row.emergency_relation || "",
        emergencyName: row.emergency_name || "",
        avatarUrl: row.avatar_url || "",
        qrCodeUrl: row.qr_code_url || "",
        status: row.status || "Active",
        createdAt: new Date(row.created_at).getTime(),
      };
    });

    // Filter by search query
    if (searchQuery) {
      employees = employees.filter((e: any) => {
        return (
          e.name?.toLowerCase().includes(searchQuery) ||
          e.mobile?.includes(searchQuery) ||
          e.employeeId?.includes(searchQuery) ||
          e.city?.toLowerCase().includes(searchQuery) ||
          e.email?.toLowerCase().includes(searchQuery) ||
          e.emergencyName?.toLowerCase().includes(searchQuery) ||
          e.emergencyContactNumber?.includes(searchQuery)
        );
      });
    }

    // Filter by city
    if (cityFilter && cityFilter !== "ALL") {
      employees = employees.filter((e: any) => e.city?.toLowerCase() === cityFilter.toLowerCase());
    }

    // Filter by salary type
    if (salaryTypeFilter && salaryTypeFilter !== "ALL") {
      employees = employees.filter((e: any) => e.salaryType === salaryTypeFilter);
    }

    // Filter by status
    if (statusFilter && statusFilter !== "ALL") {
      employees = employees.filter((e: any) => e.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    // Return All if requested (for attendance, payroll, bulk upload, ID cards)
    if (fetchAll) {
      return NextResponse.json({
        success: true,
        employees,
        pagination: {
          total: employees.length,
          totalPages: 1,
          page: 1,
          limit: employees.length,
          hasMore: false,
        },
      });
    }

    // Strictly 24 items per page default pagination
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 24;

    const total = employees.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEmployees = employees.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      employees: paginatedEmployees,
      pagination: {
        total,
        totalPages,
        page,
        limit,
        hasMore: page < totalPages,
      },
    });
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
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

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

    // 7-digit numeric Employee ID handling
    let finalEmployeeId = String(body.employeeId || "").trim();
    if (finalEmployeeId) {
      if (!/^\d{7}$/.test(finalEmployeeId)) {
        return NextResponse.json(
          { success: false, error: "Employee ID must be a unique 7-digit numeric number." },
          { status: 400 }
        );
      }
      const { data: existEmp } = await ctx.supabase
        .from("employees")
        .select("id")
        .eq("business_id", ctx.businessId)
        .eq("employee_id", finalEmployeeId)
        .maybeSingle();

      if (existEmp) {
        return NextResponse.json(
          { success: false, error: `Employee ID ${finalEmployeeId} already exists in this business.` },
          { status: 409 }
        );
      }
    } else {
      finalEmployeeId = await generateUnique7DigitEmployeeId(ctx.supabase, ctx.businessId);
    }

    // Duplicate mobile check in same business
    const { data: dupEmp } = await ctx.supabase
      .from("employees")
      .select("id")
      .eq("business_id", ctx.businessId)
      .eq("mobile", mobile)
      .maybeSingle();

    if (dupEmp) {
      return NextResponse.json(
        { success: false, error: `An employee with mobile ${mobile} already exists.` },
        { status: 409 }
      );
    }

    const qrCodeUrl = await generateAndUploadEmployeeQr(ctx.businessId, finalEmployeeId);
    const acceptedLeaves = Math.max(0, parseInt(String(body.acceptedLeaves ?? 0), 10) || 0);

    const latitude = body.latitude !== undefined && body.latitude !== null && body.latitude !== "" ? Number(body.latitude) : null;
    const longitude = body.longitude !== undefined && body.longitude !== null && body.longitude !== "" ? Number(body.longitude) : null;

    const addressPayload = JSON.stringify({
      addressText: address,
      latitude,
      longitude,
    });

    const payload = {
      business_id: ctx.businessId,
      store_id: ctx.storeId || null,
      employee_id: finalEmployeeId,
      name,
      avatar_url: avatarUrl || "",
      qr_code_url: qrCodeUrl || "",
      mobile,
      city,
      address: addressPayload,
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

    const { data: newEmp, error: insErr } = await ctx.supabase
      .from("employees")
      .insert(payload)
      .select()
      .single();

    if (insErr) {
      return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: newEmp.id,
        storeId: newEmp.store_id,
        employeeId: newEmp.employee_id,
        name: newEmp.name,
        mobile: newEmp.mobile,
        city: newEmp.city,
        address,
        latitude,
        longitude,
        email: newEmp.email || "",
        avatarUrl: newEmp.avatar_url || "",
        qrCodeUrl: newEmp.qr_code_url || "",
        salaryType: newEmp.salary_type,
        salaryAmount: newEmp.salary_amount,
        emergencyName: newEmp.emergency_name,
        emergencyRelation: newEmp.emergency_relation,
        emergencyContactNumber: newEmp.emergency_contact_number,
        status: newEmp.status || "Active",
        createdAt: new Date(newEmp.created_at).getTime(),
      },
    });
  } catch (err: any) {
    console.error("POST /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to add employee." }, { status: 500 });
  }
}

// PUT – update an existing employee
export async function PUT(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id)
      return NextResponse.json({ success: false, error: "Employee ID is required." }, { status: 400 });

    const { data: existingData, error: fError } = await ctx.supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .eq("business_id", ctx.businessId)
      .single();

    if (fError || !existingData)
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

    const latitude = body.latitude !== undefined && body.latitude !== null && body.latitude !== "" ? Number(body.latitude) : null;
    const longitude = body.longitude !== undefined && body.longitude !== null && body.longitude !== "" ? Number(body.longitude) : null;

    const addressPayload = JSON.stringify({
      addressText: address,
      latitude,
      longitude,
    });

    const updatePayload: Record<string, any> = {
      name,
      mobile,
      city,
      address: addressPayload,
      email,
      salary_type: salaryType,
      salary_amount: salaryAmount,
      emergency_contact_number: emergencyContactNumber,
      emergency_relation: emergencyRelation,
      emergency_name: emergencyName,
      updated_at: new Date().toISOString(),
    };

    if (body.avatarUrl !== undefined) {
      updatePayload.avatar_url = String(body.avatarUrl || "").trim();
    }

    if (!existingData.qr_code_url) {
      const freshQr = await generateAndUploadEmployeeQr(ctx.businessId, existingData.employee_id);
      if (freshQr) updatePayload.qr_code_url = freshQr;
    }

    if (body.acceptedLeaves !== undefined) {
      updatePayload.accepted_leaves = Math.max(0, parseInt(String(body.acceptedLeaves), 10) || 0);
    }

    const { data: updated, error: uErr } = await ctx.supabase
      .from("employees")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (uErr) {
      return NextResponse.json({ success: false, error: uErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      employee: {
        id: updated.id,
        storeId: updated.store_id,
        employeeId: updated.employee_id,
        name: updated.name,
        mobile: updated.mobile,
        city: updated.city,
        address,
        latitude,
        longitude,
        email: updated.email || "",
        avatarUrl: updated.avatar_url || "",
        qrCodeUrl: updated.qr_code_url || "",
        salaryType: updated.salary_type,
        salaryAmount: updated.salary_amount,
        emergencyName: updated.emergency_name,
        emergencyRelation: updated.emergency_relation,
        emergencyContactNumber: updated.emergency_contact_number,
        status: updated.status || "Active",
        createdAt: new Date(updated.created_at).getTime(),
      },
    });
  } catch (err: any) {
    console.error("PUT /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to update employee." }, { status: 500 });
  }
}

// DELETE – remove an employee
export async function DELETE(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id)
      return NextResponse.json({ success: false, error: "Employee ID is required." }, { status: 400 });

    const { error } = await ctx.supabase
      .from("employees")
      .delete()
      .eq("id", id)
      .eq("business_id", ctx.businessId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Employee deleted." });
  } catch (err: any) {
    console.error("DELETE /api/employees error:", err);
    return NextResponse.json({ success: false, error: "Failed to delete employee." }, { status: 500 });
  }
}
