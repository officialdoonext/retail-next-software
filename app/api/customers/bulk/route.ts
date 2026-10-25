import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/supabaseDb";

// Generate customer code (e.g. MC8539)
function generateUniqueCode(existingCodes: Set<string>, prefix = "MC"): string {
  let attempts = 0;
  while (attempts < 10000) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix.toUpperCase().slice(0, 3)}${randomNum}`;
    if (!existingCodes.has(code)) {
      existingCodes.add(code);
      return code;
    }
    attempts++;
  }
  const fallback = `${prefix}${Date.now().toString().slice(-4)}`;
  existingCodes.add(fallback);
  return fallback;
}

export async function POST(request: Request) {
  try {
    const ctx = await getBusinessContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawList = body.customers;

    if (!Array.isArray(rawList) || rawList.length === 0) {
      return NextResponse.json(
        { success: false, error: "No customer data provided for bulk upload." },
        { status: 400 }
      );
    }

    // Fetch existing customers in this business to prevent duplicate phones
    const { data: existingRows } = await ctx.supabase
      .from("customers")
      .select("phone, address")
      .eq("business_id", ctx.businessId);

    const existingPhones = new Set<string>();
    const existingCodes = new Set<string>();

    (existingRows || []).forEach((row: any) => {
      if (row.phone) existingPhones.add(String(row.phone).trim());
      if (row.address && typeof row.address === "string" && row.address.startsWith("{")) {
        try {
          const parsed = JSON.parse(row.address);
          if (parsed?.customerCode) {
            existingCodes.add(String(parsed.customerCode).trim().toUpperCase());
          }
        } catch {}
      }
    });

    const savedCustomers: any[] = [];
    const skippedDuplicates: string[] = [];

    const CHUNK_SIZE = 10;
    for (let i = 0; i < rawList.length; i += CHUNK_SIZE) {
      const chunk = rawList.slice(i, i + CHUNK_SIZE);
      const rowsToInsert: any[] = [];

      for (const row of chunk) {
        const name = String(row.name || row["Customer Name"] || row.Name || "").trim();
        const rawPhone = String(row.phone || row["Mobile Number"] || row.Mobile || row.mobile || "").replace(/\D/g, "");
        const city = String(row.city || row["City"] || row.City || "VIJAYAWADA").trim();
        const addressText = String(row.address || row["Full Address"] || row.Address || "").trim() || `${city}, Local`;
        const email = String(row.email || row["Email"] || row.Email || "").trim().toLowerCase();
        const pin = String(row.pin || row["PIN"] || row.Pin || "").trim();
        const customerGroup = String(row.customerGroup || row["Customer Group"] || row.group || "Retail").trim();
        const creditLimit = Math.max(0, Number(row.creditLimit || row["Credit Limit"] || 0) || 0);
        const creditDays = Math.max(0, Number(row.creditDays || row["Credit Days"] || 0) || 0);
        const gstNumber = String(row.gstNumber || row["GST Number"] || row.gst || "").trim().toUpperCase();
        const placeOfSupply = String(row.placeOfSupply || row["Place of Supply"] || "37-Andhra Pradesh").trim();
        const discountPercent = Math.max(0, Number(row.discountPercent || row["Discount %"] || row.discount || 0) || 0);
        const remarks = String(row.remarks || row["Remarks"] || "").trim();

        if (!name || rawPhone.length < 10) {
          continue;
        }

        const cleanPhone = rawPhone.slice(-10);
        if (existingPhones.has(cleanPhone)) {
          skippedDuplicates.push(`${name} (${cleanPhone})`);
          continue;
        }
        existingPhones.add(cleanPhone);

        let customerCode = String(row.customerCode || row["Customer Code"] || "").trim().toUpperCase();
        if (!customerCode || existingCodes.has(customerCode)) {
          customerCode = generateUniqueCode(existingCodes, "MC");
        } else {
          existingCodes.add(customerCode);
        }

        const extraFields = {
          customerCode,
          addressText,
          pin,
          birthDate: "",
          hasBirthDate: false,
          anniversaryDate: "",
          hasAnniversary: false,
          cardNo: "",
          cardValidity: "2500-01-01",
          entryDate: new Date().toISOString().split("T")[0],
          tin: "",
          branch: "MADHU CREATIONS",
          ledger: "Sundry Debtors",
          stopCredit: false,
          opCreditBalance: 0,
          creditDays,
          creditLimit,
          customerGroup,
          classification: "General",
          landline: "",
          billCycle: 1,
          opSales: 0,
          remarks,
          placeOfSupply,
          discountPercent,
          applyDiscountNonDisc: false,
          isInactive: false,
          blockTSms: false,
          blockPSms: false,
          blockWa: false,
          dontFollowup: false,
        };

        rowsToInsert.push({
          business_id: ctx.businessId,
          store_id: ctx.storeId || null,
          name,
          phone: cleanPhone,
          email: email || "",
          city: city || "VIJAYAWADA",
          address: JSON.stringify(extraFields),
          gst_number: gstNumber || null,
          total_purchases: 0,
          loyalty_points: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      if (rowsToInsert.length > 0) {
        const { data: inserted, error: insertError } = await ctx.supabase
          .from("customers")
          .insert(rowsToInsert)
          .select();

        if (insertError) {
          console.error("Error inserting customer bulk chunk:", insertError);
          throw new Error(insertError.message || "Failed to insert customer rows.");
        }

        if (inserted) {
          savedCustomers.push(...inserted);
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: savedCustomers.length,
      skippedCount: skippedDuplicates.length,
      skippedDuplicates,
      customers: savedCustomers,
    });
  } catch (err: any) {
    console.error("Bulk upload error in /api/customers/bulk:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to process bulk customer upload." },
      { status: 500 }
    );
  }
}
