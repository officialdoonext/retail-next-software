/**
 * ESC/POS Thermal Receipt Printer Command Generator for RetailNext
 * Supports 2-inch (58mm / 32 columns) and 3-inch (80mm / 48 columns) thermal rolls
 * Fully occupies paper width with razor-sharp alignments, double-height headers,
 * itemized tables, GST breakdowns, split tenders, and auto-cut commands.
 */

export interface ReceiptItem {
  name: string;
  variantName?: string | null;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptData {
  storeName?: string;
  storeAddress?: string;
  storeCity?: string;
  storeState?: string;
  storePincode?: string;
  storePhone?: string;
  storeEmail?: string;
  storeGst?: string;
  enableGst?: boolean;
  billNumber: string;
  createdAt?: number | string;
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;
  cashierName?: string;
  paymentMethod: string;
  splitDetails?: {
    cash?: number;
    upi?: number;
    card?: number;
  } | null;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  cgst?: number;
  sgst?: number;
  roundOff?: number;
  grandTotal: number;
  notes?: string;
}

/**
 * Word wrap helper that breaks strings cleanly at word boundaries
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (!text) return [];
  const words = text.toString().trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      if (word.length > maxWidth) {
        for (let i = 0; i < word.length; i += maxWidth) {
          lines.push(word.substring(i, i + maxWidth));
        }
      } else {
        currentLine = word;
      }
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      if (word.length > maxWidth) {
        for (let i = 0; i < word.length; i += maxWidth) {
          if (i + maxWidth < word.length) {
            lines.push(word.substring(i, i + maxWidth));
          } else {
            currentLine = word.substring(i);
          }
        }
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private paperWidth: "58mm" | "80mm";

  constructor(paperWidth: "58mm" | "80mm" = "80mm") {
    this.paperWidth = paperWidth;
  }

  // Column width helper (58mm = 32 cols, 80mm = 48 cols)
  public get maxColumns(): number {
    return this.paperWidth === "58mm" ? 32 : 48;
  }

  // Initialize printer
  public init(): EscPosBuilder {
    this.buffer.push(0x1b, 0x40); // ESC @
    this.alignLeft();
    return this;
  }

  // Alignment
  public alignLeft(): EscPosBuilder {
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  public alignCenter(): EscPosBuilder {
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  public alignRight(): EscPosBuilder {
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  // Text Styling
  public bold(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1b, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  public doubleSize(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1d, 0x21, enable ? 0x11 : 0x00); // GS ! 0x11
    return this;
  }

  public doubleHeight(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1d, 0x21, enable ? 0x01 : 0x00); // GS ! 0x01
    return this;
  }

  public doubleWidth(enable: boolean = true): EscPosBuilder {
    this.buffer.push(0x1d, 0x21, enable ? 0x10 : 0x00); // GS ! 0x10
    return this;
  }

  // Spacing & Feeds
  public feed(lines: number = 1): EscPosBuilder {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  // Text output
  public text(str: string): EscPosBuilder {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);
    for (let i = 0; i < encoded.length; i++) {
      this.buffer.push(encoded[i]);
    }
    return this;
  }

  public textLine(str: string = ""): EscPosBuilder {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  public textLineCentered(str: string): EscPosBuilder {
    const lines = wrapText(str, this.maxColumns);
    for (const l of lines) {
      const pad = Math.max(0, Math.floor((this.maxColumns - l.length) / 2));
      this.textLine(" ".repeat(pad) + l);
    }
    return this;
  }

  public textLineWrapped(str: string, indent: number = 0): EscPosBuilder {
    const lines = wrapText(str, this.maxColumns - indent);
    const padStr = " ".repeat(indent);
    for (const l of lines) {
      this.textLine(padStr + l);
    }
    return this;
  }

  // Dividers
  public drawLine(char: string = "-"): EscPosBuilder {
    return this.textLine(char.repeat(this.maxColumns));
  }

  // 2-column key-value row (Left & Right aligned, fully occupying paper width)
  public row2(left: string, right: string): EscPosBuilder {
    const cols = this.maxColumns;
    if (left.length + right.length + 1 <= cols) {
      const spaceCount = cols - left.length - right.length;
      return this.textLine(left + " ".repeat(spaceCount) + right);
    } else {
      this.textLine(left);
      const pad = Math.max(0, cols - right.length);
      return this.textLine(" ".repeat(pad) + right);
    }
  }

  // Cut Paper
  public cut(partial: boolean = false): EscPosBuilder {
    this.feed(3);
    this.buffer.push(0x1d, 0x56, partial ? 0x01 : 0x00);
    return this;
  }

  // Sound Buzzer
  public beep(times: number = 1): EscPosBuilder {
    this.buffer.push(0x1b, 0x42, Math.min(times, 5), 0x02);
    return this;
  }

  // Open Cash Drawer
  public openCashDrawer(): EscPosBuilder {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  public toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Generate a complete Test Print ESC/POS receipt
 */
export function generateTestReceipt(paperWidth: "58mm" | "80mm" = "80mm"): Uint8Array {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const builder = new EscPosBuilder(paperWidth);
  const is2Inch = paperWidth === "58mm";

  builder.init().bold(true);
  builder.doubleHeight(true).textLineCentered("RETAIL NEXT STORE").doubleHeight(false);

  builder
    .bold(false)
    .textLineCentered("Smart Retail & POS Terminal")
    .textLineCentered(`Thermal Printer Test (${is2Inch ? "2 Inch / 58mm" : "3 Inch / 80mm"})`)
    .drawLine("=")
    .alignLeft()
    .textLine(`Date: ${dateStr} ${timeStr}`)
    .textLine(`Interface: Web USB / Bluetooth BLE`)
    .textLine(`Status: Online & Ready to Print`)
    .drawLine("-");

  if (is2Inch) {
    builder.bold(true).row2("ITEM / QTY", "AMOUNT").bold(false).drawLine("-");
    builder.textLine("Sample Grocery Item");
    builder.row2("  2 pcs @ Rs.150.00", "Rs.300.00");
  } else {
    builder.bold(true);
    const hName = "ITEM DESCRIPTION".padEnd(22).substring(0, 22);
    const hQty = "QTY".padStart(8).substring(0, 8);
    const hRate = "RATE".padStart(8).substring(0, 8);
    const hTotal = "TOTAL".padStart(10).substring(0, 10);
    builder.textLine(`${hName}${hQty}${hRate}${hTotal}`).bold(false).drawLine("-");

    const colN = "Sample Grocery Item".padEnd(22).substring(0, 22);
    const colQ = "2 pcs".padStart(8).substring(0, 8);
    const colR = "150.00".padStart(8).substring(0, 8);
    const colT = "300.00".padStart(10).substring(0, 10);
    builder.textLine(`${colN}${colQ}${colR}${colT}`);
  }

  builder
    .drawLine("-")
    .row2("Subtotal:", "Rs.300.00")
    .row2("GST (18% Included):", "Rs.45.76")
    .drawLine("=")
    .bold(true);

  builder.doubleHeight(true).row2("NET TOTAL:", "Rs.300.00").doubleHeight(false);

  builder
    .bold(false)
    .drawLine("=")
    .alignCenter()
    .bold(true)
    .textLineCentered("*** HARDWARE TEST PASSED ***")
    .bold(false)
    .textLineCentered("Powered by RetailNext")
    .feed(2)
    .cut()
    .beep(1);

  return builder.toUint8Array();
}

/**
 * Generate formatted ESC/POS bytes from bill data
 * Perfectly scales for 2-inch (58mm) and 3-inch (80mm) rolls
 */
export function generateReceiptEscPos(
  data: ReceiptData,
  paperWidth: "58mm" | "80mm" = "80mm"
): Uint8Array {
  const builder = new EscPosBuilder(paperWidth);
  const is2Inch = paperWidth === "58mm";

  const dateObj = data.createdAt ? new Date(data.createdAt) : new Date();
  const dateStr = dateObj.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = dateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // 1. STORE HEADER
  builder.init().bold(true);

  const storeName = (data.storeName || "RETAIL NEXT STORE").toUpperCase();
  const maxDoubleHeightLength = is2Inch ? 24 : 36;
  if (storeName.length <= maxDoubleHeightLength) {
    builder.doubleHeight(true).textLineCentered(storeName).doubleHeight(false);
  } else {
    builder.textLineCentered(storeName);
  }

  builder.bold(false);

  // Address
  const addrParts = [data.storeAddress, data.storeCity, data.storeState, data.storePincode]
    .filter(Boolean)
    .join(", ");
  if (addrParts) {
    builder.textLineCentered(addrParts);
  }

  if (data.storePhone) {
    builder.textLineCentered(`Phone: ${data.storePhone}`);
  }
  if (data.storeEmail) {
    builder.textLineCentered(`Email: ${data.storeEmail}`);
  }
  if (data.storeGst && data.enableGst) {
    builder.textLineCentered(`GSTIN: ${data.storeGst}`);
  }

  // 2. INVOICE METADATA
  builder.drawLine("=").alignLeft();
  builder.bold(true).row2(`Invoice: ${data.billNumber}`, `${dateStr}`).bold(false);
  builder.row2(`Time: ${timeStr}`, `Tender: ${data.paymentMethod.toUpperCase()}`);

  if (data.customerName || data.customerPhone) {
    const cName = data.customerName || "Walk-in Customer";
    const cPhone = data.customerPhone ? ` (${data.customerPhone})` : "";
    builder.textLineWrapped(`Customer: ${cName}${cPhone}`);
  }
  if (data.cashierName) {
    builder.textLine(`Cashier: ${data.cashierName}`);
  }

  // 3. ITEM TABLE (Fully occupying paper width)
  builder.drawLine("-");

  if (is2Inch) {
    // 2-Inch (58mm) Layout (32 Columns)
    builder.bold(true).row2("ITEM / QTY & RATE", "TOTAL").bold(false).drawLine("-");

    data.items.forEach((item) => {
      const displayName = item.variantName
        ? `${item.name} (${item.variantName})`
        : item.name;
      builder.textLineWrapped(displayName);

      const qtyLine = `  ${item.quantity} x Rs.${Number(item.price).toFixed(2)}`;
      const totalStr = `Rs.${Number(item.total).toFixed(2)}`;
      builder.row2(qtyLine, totalStr);
    });
  } else {
    // 3-Inch (80mm) Layout (48 Columns: 22 + 8 + 8 + 10 = 48)
    builder.bold(true);
    const hName = "ITEM DESCRIPTION".padEnd(22).substring(0, 22);
    const hQty = "QTY".padStart(8).substring(0, 8);
    const hRate = "RATE".padStart(8).substring(0, 8);
    const hTotal = "TOTAL".padStart(10).substring(0, 10);
    builder.textLine(`${hName}${hQty}${hRate}${hTotal}`).bold(false).drawLine("-");

    data.items.forEach((item) => {
      const displayName = item.variantName
        ? `${item.name} (${item.variantName})`
        : item.name;

      const qtyText = `${item.quantity}`;
      const rateText = Number(item.price).toFixed(2);
      const totalText = Number(item.total).toFixed(2);

      const colQ = qtyText.padStart(8).substring(0, 8);
      const colR = rateText.padStart(8).substring(0, 8);
      const colT = totalText.padStart(10).substring(0, 10);

      if (displayName.length > 22) {
        builder.textLine(displayName);
        const padSpace = " ".repeat(22);
        builder.textLine(`${padSpace}${colQ}${colR}${colT}`);
      } else {
        const colN = displayName.padEnd(22).substring(0, 22);
        builder.textLine(`${colN}${colQ}${colR}${colT}`);
      }
    });
  }

  // 4. FINANCIAL TOTALS
  builder.drawLine("-");
  builder.row2("Total Items / Qty:", `${data.items.length} item(s)`);
  builder.row2("Subtotal:", `Rs.${Number(data.subtotal).toFixed(2)}`);

  if (data.discount && data.discount > 0) {
    builder.row2("Store Discount:", `-Rs.${Number(data.discount).toFixed(2)}`);
  }
  if (data.cgst && data.cgst > 0) {
    builder.row2("CGST:", `Rs.${Number(data.cgst).toFixed(2)}`);
  }
  if (data.sgst && data.sgst > 0) {
    builder.row2("SGST:", `Rs.${Number(data.sgst).toFixed(2)}`);
  }
  if (data.roundOff && data.roundOff !== 0) {
    builder.row2("Round Off:", `Rs.${Number(data.roundOff).toFixed(2)}`);
  }

  builder.drawLine("=").bold(true);
  builder.doubleHeight(true).row2("GRAND TOTAL:", `Rs.${Number(data.grandTotal).toFixed(2)}`).doubleHeight(false);
  builder.bold(false).drawLine("=");

  // Split details breakdown if applicable
  if (data.paymentMethod === "SPLIT" && data.splitDetails) {
    builder.row2("Split Details:", `UPI: Rs.${Number(data.splitDetails.upi || 0).toFixed(2)}`);
    builder.row2("", `Cash: Rs.${Number(data.splitDetails.cash || 0).toFixed(2)} | Card: Rs.${Number(data.splitDetails.card || 0).toFixed(2)}`);
    builder.drawLine("-");
  }

  if (data.notes) {
    builder.textLineWrapped(`Notes: ${data.notes}`);
    builder.drawLine("-");
  }

  // 5. FOOTER & CUT
  builder
    .alignCenter()
    .feed(1)
    .textLineCentered("Thank you for shopping with us!")
    .textLineCentered("Please visit again")
    .feed(2)
    .cut()
    .beep(1);

  return builder.toUint8Array();
}
