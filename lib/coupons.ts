export type CouponType = "order" | "product" | "customer";
export type DiscountType = "percentage" | "flat" | "bogo" | "bundle";
export type CouponStatus = "Active" | "Inactive" | "Scheduled" | "Expired";

export interface CouponItem {
  id: string;
  type: CouponType;
  code: string;
  title: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number; // % rate or flat rupee amount
  maxDiscountCap?: number; // Cap in rupees for percentage discounts
  minOrderValue?: number; // Minimum cart value to qualify

  // Product Coupons Specific
  targetType?: "all" | "products" | "categories";
  targetProductIds?: string[]; // IDs or names of target products
  targetCategoryIds?: string[]; // IDs or names of target categories
  bogoBuyQty?: number; // Buy X
  bogoGetQty?: number; // Get Y
  bogoDiscountPercent?: number; // e.g. 100 for Free, 50 for Half price
  bundleQty?: number; // Buy N items
  bundlePrice?: number; // for flat ₹X

  // Customer Coupons Specific
  customerScope?: "all" | "individual" | "group" | "milestone";
  targetCustomerPhones?: string[]; // Single or multiple phone numbers
  targetCustomerGroup?: string; // "VIP" | "Retail" | "Wholesale" | "Corporate"
  milestoneType?: "birthday" | "anniversary" | "first_order" | "win_back";
  isSingleUsePerCustomer?: boolean;

  // Usage Controls
  totalUsageLimit?: number; // Maximum total redemptions
  usedCount: number; // Current redemptions count
  perCustomerLimit?: number; // Maximum redemptions per shopper (default 1)
  allowedPaymentModes?: string[]; // ["All", "Cash", "UPI", "Card"]
  excludeSaleItems?: boolean;
  autoApplyAtCheckout?: boolean;

  // Validity
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endDate: string; // YYYY-MM-DD
  endTime?: string; // HH:mm
  neverExpires?: boolean;
  status: CouponStatus;

  createdAt: number;
  updatedAt: number;
}

// Generate an authentic random alphanumeric coupon code
export function generateRandomCouponCode(prefix = "PROMO"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix.toUpperCase()}-${randomPart}`;
}

// Compute active / scheduled / expired state based on dates
export function computeCouponStatus(coupon: {
  status: CouponStatus;
  startDate: string;
  endDate: string;
  neverExpires?: boolean;
}): CouponStatus {
  if (coupon.status === "Inactive") return "Inactive";
  if (coupon.neverExpires) return "Active";

  const now = new Date().toISOString().split("T")[0];
  if (coupon.startDate && coupon.startDate > now) {
    return "Scheduled";
  }
  if (coupon.endDate && coupon.endDate < now) {
    return "Expired";
  }
  return "Active";
}

// Format discount badge text for quick display
export function formatDiscountDisplay(c: CouponItem): string {
  if (c.discountType === "percentage") {
    const cap = c.maxDiscountCap ? ` (Max ₹${c.maxDiscountCap.toLocaleString("en-IN")})` : "";
    return `${c.discountValue}% OFF${cap}`;
  }
  if (c.discountType === "flat") {
    return `FLAT ₹${c.discountValue.toLocaleString("en-IN")} OFF`;
  }
  if (c.discountType === "bogo") {
    const freeText = (c.bogoDiscountPercent || 100) === 100 ? "FREE" : `${c.bogoDiscountPercent}% OFF`;
    return `BUY ${c.bogoBuyQty || 1} GET ${c.bogoGetQty || 1} ${freeText}`;
  }
  if (c.discountType === "bundle") {
    return `BUY ${c.bundleQty || 3} FOR ₹${(c.bundlePrice || 999).toLocaleString("en-IN")}`;
  }
  return `PROMO DEAL`;
}

// Initial Starter Coupons: 100% clean, no dummy or static data
export const INITIAL_ORDER_COUPONS: CouponItem[] = [];
export const INITIAL_PRODUCT_COUPONS: CouponItem[] = [];
export const INITIAL_CUSTOMER_COUPONS: CouponItem[] = [];
