import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, AUTH_COOKIE_NAME, ACTIVE_STORE_COOKIE } from "@/lib/auth";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  doc,
  deleteDoc,
  getDoc,
  addDoc,
} from "firebase/firestore";

async function getStoreContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const storeId = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  if (!token || !storeId) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  return { session, storeId };
}

function extractNumericValue(str: string): number | null {
  const matches = str.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const lastGroup = matches[matches.length - 1];
  const num = parseInt(lastGroup, 10);
  return isNaN(num) ? null : num;
}

// GET: Fetch serial numbers for active store and calculate next start number
export async function GET(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const serialsRef = collection(db, "serial_numbers");
    const q = query(serialsRef, where("storeId", "==", ctx.storeId));
    const snap = await getDocs(q);

    let maxNumber = 0;
    const serialNumbers = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const num =
        typeof data.numericValue === "number"
          ? data.numericValue
          : extractNumericValue(data.serialNumber || "") || 0;

      if (num > maxNumber) {
        maxNumber = num;
      }

      return {
        id: docSnap.id,
        serialNumber: String(data.serialNumber || ""),
        numericValue: num,
        status: data.status || "Available",
        createdBy: data.createdBy || "",
        createdAt: data.createdAt || 0,
      };
    });

    const nextStartNumber = maxNumber > 0 ? maxNumber + 1 : 1;

    // Sort by numericValue ascending, then createdAt descending
    serialNumbers.sort((a, b) => {
      if (a.numericValue !== b.numericValue && a.numericValue > 0 && b.numericValue > 0) {
        return a.numericValue - b.numericValue;
      }
      return b.createdAt - a.createdAt;
    });

    return NextResponse.json({
      success: true,
      serialNumbers,
      totalCount: serialNumbers.length,
      nextStartNumber,
    });
  } catch (error) {
    console.error("Error fetching serial numbers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch serial numbers." },
      { status: 500 }
    );
  }
}

// POST: Add single serial number OR bulk create serial numbers
export async function POST(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized or no active store selected." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const mode = body.mode || "single";
    const serialsRef = collection(db, "serial_numbers");
    const now = Date.now();

    // Mode 1: Single Serial Number
    if (mode === "single") {
      const serialNumber = String(body.serialNumber || "").trim();

      if (!serialNumber) {
        return NextResponse.json(
          { success: false, error: "Serial number is required." },
          { status: 400 }
        );
      }

      const numericValue = extractNumericValue(serialNumber) || 0;

      const serialData = {
        serialNumber,
        numericValue,
        status: "Available",
        storeId: ctx.storeId,
        createdBy: ctx.session.email,
        createdAt: now,
      };

      const docRef = await addDoc(serialsRef, serialData);

      return NextResponse.json({
        success: true,
        serial: {
          id: docRef.id,
          ...serialData,
        },
      });
    }

    // Mode 2: Bulk Create Serial Numbers
    if (mode === "bulk") {
      const startNumber = parseInt(body.startNumber, 10);
      const endNumber = parseInt(body.endNumber, 10);
      const prefix = String(body.prefix || "").trim();

      if (isNaN(startNumber) || startNumber < 1) {
        return NextResponse.json(
          { success: false, error: "Start number must be a valid number >= 1." },
          { status: 400 }
        );
      }

      if (isNaN(endNumber) || endNumber < startNumber) {
        return NextResponse.json(
          { success: false, error: `End number must be greater than or equal to start number (${startNumber}).` },
          { status: 400 }
        );
      }

      const totalToCreate = endNumber - startNumber + 1;
      if (totalToCreate > 2000) {
        return NextResponse.json(
          { success: false, error: "Maximum 2,000 serial numbers can be generated in a single bulk operation." },
          { status: 400 }
        );
      }

      const itemsToInsert = [];
      for (let num = startNumber; num <= endNumber; num++) {
        const serialNumber = prefix ? `${prefix}${num}` : `${num}`;
        itemsToInsert.push({
          serialNumber,
          numericValue: num,
          status: "Available",
          storeId: ctx.storeId,
          createdBy: ctx.session.email,
          createdAt: now,
        });
      }

      // Write in chunks of 400 with writeBatch
      const chunkSize = 400;
      let createdCount = 0;

      for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
        const chunk = itemsToInsert.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
          const newDocRef = doc(serialsRef);
          batch.set(newDocRef, item);
          createdCount++;
        });

        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        createdCount,
        startNumber,
        endNumber,
        nextStartNumber: endNumber + 1,
        message: `Successfully created ${createdCount} serial numbers (${startNumber} to ${endNumber}).`,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid creation mode." }, { status: 400 });
  } catch (error) {
    console.error("Error creating serial number(s):", error);
    return NextResponse.json(
      { success: false, error: "Failed to create serial number(s)." },
      { status: 500 }
    );
  }
}

// DELETE: Delete single serial number or bulk delete
export async function DELETE(request: Request) {
  try {
    const ctx = await getStoreContext();
    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const serialId = searchParams.get("id");

    // Single delete
    if (serialId) {
      const serialDocRef = doc(db, "serial_numbers", serialId);
      const snap = await getDoc(serialDocRef);

      if (!snap.exists()) {
        return NextResponse.json({ success: false, error: "Serial number not found." }, { status: 404 });
      }

      if (snap.data().storeId !== ctx.storeId) {
        return NextResponse.json(
          { success: false, error: "Access denied to serial number." },
          { status: 403 }
        );
      }

      await deleteDoc(serialDocRef);
      return NextResponse.json({ success: true, message: "Serial number deleted successfully." });
    }

    // Bulk delete via JSON body
    let body: any = null;
    try {
      body = await request.json();
    } catch {}

    if (body && Array.isArray(body.ids) && body.ids.length > 0) {
      const ids: string[] = body.ids;
      const chunkSize = 400;
      let deletedCount = 0;

      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach((id) => {
          const docRef = doc(db, "serial_numbers", id);
          batch.delete(docRef);
          deletedCount++;
        });

        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `Successfully deleted ${deletedCount} serial numbers.`,
      });
    }

    return NextResponse.json(
      { success: false, error: "Serial number ID or list of IDs is required." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error deleting serial number(s):", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete serial number(s)." },
      { status: 500 }
    );
  }
}
