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

// Initial Starter Order Coupons
export const INITIAL_ORDER_COUPONS: CouponItem[] = [
  {
    id: "ord-cp-1",
    type: "order",
    code: "WELCOME100",
    title: "First Order Welcome Treat",
    description: "Flat ₹100 instant discount on all first-time store purchases above ₹499.",
    discountType: "flat",
    discountValue: 100,
    minOrderValue: 499,
    totalUsageLimit: 1000,
    usedCount: 348,
    perCustomerLimit: 1,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: false,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 60 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 60 * 24 * 3600 * 1000,
  },
  {
    id: "ord-cp-2",
    type: "order",
    code: "FESTIVE20",
    title: "Festive Season Cart Bonanza",
    description: "Enjoy 20% discount on total cart value above ₹1,999 up to maximum discount ₹1,000.",
    discountType: "percentage",
    discountValue: 20,
    maxDiscountCap: 1000,
    minOrderValue: 1999,
    totalUsageLimit: 500,
    usedCount: 289,
    perCustomerLimit: 2,
    allowedPaymentModes: ["All"],
    excludeSaleItems: true,
    autoApplyAtCheckout: false,
    startDate: "2026-10-01",
    endDate: "2026-11-30",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 25 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 25 * 24 * 3600 * 1000,
  },
  {
    id: "ord-cp-3",
    type: "order",
    code: "FLAT500",
    title: "Mega Shopping Spree",
    description: "Flat ₹500 off on shopping bills above ₹4,999 across all retail departments.",
    discountType: "flat",
    discountValue: 500,
    minOrderValue: 4999,
    totalUsageLimit: 300,
    usedCount: 167,
    perCustomerLimit: 3,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: false,
    startDate: "2026-08-15",
    endDate: "2026-12-31",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 40 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 40 * 24 * 3600 * 1000,
  },
  {
    id: "ord-cp-4",
    type: "order",
    code: "UPI50",
    title: "Digital UPI Instant Savings",
    description: "Flat ₹50 rebate when paying via PhonePe, GooglePay, Paytm or BHIM UPI.",
    discountType: "flat",
    discountValue: 50,
    minOrderValue: 699,
    totalUsageLimit: 2000,
    usedCount: 842,
    perCustomerLimit: 5,
    allowedPaymentModes: ["UPI"],
    excludeSaleItems: false,
    autoApplyAtCheckout: true,
    startDate: "2026-05-01",
    endDate: "2026-12-31",
    neverExpires: true,
    status: "Active",
    createdAt: Date.now() - 90 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 90 * 24 * 3600 * 1000,
  },
  {
    id: "ord-cp-5",
    type: "order",
    code: "WEEKEND15",
    title: "Weekend Super Saver",
    description: "15% off on weekend shopping bills above ₹1,499 up to ₹600 discount.",
    discountType: "percentage",
    discountValue: 15,
    maxDiscountCap: 600,
    minOrderValue: 1499,
    totalUsageLimit: 400,
    usedCount: 0,
    perCustomerLimit: 1,
    allowedPaymentModes: ["All"],
    excludeSaleItems: true,
    autoApplyAtCheckout: false,
    startDate: "2026-11-01",
    endDate: "2026-11-30",
    neverExpires: false,
    status: "Scheduled",
    createdAt: Date.now() - 5 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 5 * 24 * 3600 * 1000,
  },
];

// Initial Starter Product Coupons
export const INITIAL_PRODUCT_COUPONS: CouponItem[] = [
  {
    id: "prd-cp-1",
    type: "product",
    code: "DENIM30",
    title: "Denim & Jeans Festival",
    description: "Flat 30% discount on all men's and women's denim jeans and jackets.",
    discountType: "percentage",
    discountValue: 30,
    maxDiscountCap: 1500,
    minOrderValue: 999,
    targetType: "categories",
    targetCategoryIds: ["Jeans", "Denim Wear"],
    totalUsageLimit: 400,
    usedCount: 215,
    perCustomerLimit: 2,
    allowedPaymentModes: ["All"],
    excludeSaleItems: true,
    autoApplyAtCheckout: false,
    startDate: "2026-09-01",
    endDate: "2026-11-15",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 30 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 30 * 24 * 3600 * 1000,
  },
  {
    id: "prd-cp-2",
    type: "product",
    code: "BOGO-SHIRT",
    title: "Buy 2 Get 1 Free on Shirts",
    description: "Buy any 2 Formal or Casual Shirts and get the 3rd shirt completely free.",
    discountType: "bogo",
    discountValue: 100,
    bogoBuyQty: 2,
    bogoGetQty: 1,
    bogoDiscountPercent: 100,
    minOrderValue: 0,
    targetType: "categories",
    targetCategoryIds: ["Formal Shirts", "Casual Shirts"],
    totalUsageLimit: 300,
    usedCount: 178,
    perCustomerLimit: 1,
    allowedPaymentModes: ["All"],
    excludeSaleItems: true,
    autoApplyAtCheckout: true,
    startDate: "2026-10-01",
    endDate: "2026-11-20",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 20 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 20 * 24 * 3600 * 1000,
  },
  {
    id: "prd-cp-3",
    type: "product",
    code: "BUNDLE-TEE",
    title: "Pack of 3 Cotton T-Shirts",
    description: "Pick any 3 Crew Neck or Polo Cotton T-Shirts for a bundled price of ₹999.",
    discountType: "bundle",
    discountValue: 999,
    bundleQty: 3,
    bundlePrice: 999,
    minOrderValue: 0,
    targetType: "categories",
    targetCategoryIds: ["T-Shirts", "Polos"],
    totalUsageLimit: 500,
    usedCount: 312,
    perCustomerLimit: 3,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: true,
    startDate: "2026-07-01",
    endDate: "2026-12-31",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 80 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 80 * 24 * 3600 * 1000,
  },
  {
    id: "prd-cp-4",
    type: "product",
    code: "SILK-15",
    title: "Pure Silk Sarees Exclusive",
    description: "Special 15% discount on Kanchipuram and Banarasi Silk Sarees collection.",
    discountType: "percentage",
    discountValue: 15,
    maxDiscountCap: 2500,
    minOrderValue: 4999,
    targetType: "categories",
    targetCategoryIds: ["Silk Sarees", "Ethnic Wear"],
    totalUsageLimit: 200,
    usedCount: 94,
    perCustomerLimit: 2,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: false,
    startDate: "2026-09-15",
    endDate: "2026-11-30",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 35 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 35 * 24 * 3600 * 1000,
  },
  {
    id: "prd-cp-5",
    type: "product",
    code: "WINTER-FLAT400",
    title: "Winter Jackets Early Bird",
    description: "Flat ₹400 off on all thermal jackets, blazers, and cardigans above ₹2,499.",
    discountType: "flat",
    discountValue: 400,
    minOrderValue: 2499,
    targetType: "categories",
    targetCategoryIds: ["Winter Wear", "Jackets"],
    totalUsageLimit: 250,
    usedCount: 0,
    perCustomerLimit: 1,
    allowedPaymentModes: ["All"],
    excludeSaleItems: true,
    autoApplyAtCheckout: false,
    startDate: "2026-11-10",
    endDate: "2026-12-31",
    neverExpires: false,
    status: "Scheduled",
    createdAt: Date.now() - 2 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 2 * 24 * 3600 * 1000,
  },
];

// Initial Starter Customer Coupons
export const INITIAL_CUSTOMER_COUPONS: CouponItem[] = [
  {
    id: "cst-cp-1",
    type: "customer",
    code: "VIP-PRIVILEGE",
    title: "VIP Loyalty Club 25% Off",
    description: "Exclusive 25% discount voucher for registered VIP Club members on orders above ₹1,999.",
    discountType: "percentage",
    discountValue: 25,
    maxDiscountCap: 2000,
    minOrderValue: 1999,
    customerScope: "group",
    targetCustomerGroup: "VIP",
    isSingleUsePerCustomer: false,
    totalUsageLimit: 500,
    usedCount: 164,
    perCustomerLimit: 3,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: false,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    neverExpires: true,
    status: "Active",
    createdAt: Date.now() - 100 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 100 * 24 * 3600 * 1000,
  },
  {
    id: "cst-cp-2",
    type: "customer",
    code: "BDAY-OCT500",
    title: "Birthday Month Special Treat",
    description: "Flat ₹500 birthday gift voucher for shoppers celebrating their birthday this month.",
    discountType: "flat",
    discountValue: 500,
    minOrderValue: 1500,
    customerScope: "milestone",
    milestoneType: "birthday",
    isSingleUsePerCustomer: true,
    totalUsageLimit: 300,
    usedCount: 88,
    perCustomerLimit: 1,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: false,
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 25 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 25 * 24 * 3600 * 1000,
  },
  {
    id: "cst-cp-3",
    type: "customer",
    code: "ANNIV-GIFT",
    title: "Wedding Anniversary Voucher",
    description: "15% off celebration voucher sent to patrons celebrating wedding anniversary.",
    discountType: "percentage",
    discountValue: 15,
    maxDiscountCap: 1500,
    minOrderValue: 2500,
    customerScope: "milestone",
    milestoneType: "anniversary",
    isSingleUsePerCustomer: true,
    totalUsageLimit: 250,
    usedCount: 71,
    perCustomerLimit: 1,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: false,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    neverExpires: true,
    status: "Active",
    createdAt: Date.now() - 60 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 60 * 24 * 3600 * 1000,
  },
  {
    id: "cst-cp-4",
    type: "customer",
    code: "WINBACK300",
    title: "We Miss You - Win Back Voucher",
    description: "Flat ₹300 incentive voucher for valuable customers who haven't shopped in past 60 days.",
    discountType: "flat",
    discountValue: 300,
    minOrderValue: 1200,
    customerScope: "milestone",
    milestoneType: "win_back",
    isSingleUsePerCustomer: true,
    totalUsageLimit: 500,
    usedCount: 142,
    perCustomerLimit: 1,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: false,
    startDate: "2026-08-01",
    endDate: "2026-12-31",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 50 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 50 * 24 * 3600 * 1000,
  },
  {
    id: "cst-cp-5",
    type: "customer",
    code: "PATRON-ANANYA",
    title: "Personalized Client Token",
    description: "Exclusive single-use token assigned specifically to mobile: 9811000002 (Aditi Rao).",
    discountType: "flat",
    discountValue: 250,
    minOrderValue: 1000,
    customerScope: "individual",
    targetCustomerPhones: ["9811000002"],
    isSingleUsePerCustomer: true,
    totalUsageLimit: 1,
    usedCount: 0,
    perCustomerLimit: 1,
    allowedPaymentModes: ["All"],
    excludeSaleItems: false,
    autoApplyAtCheckout: false,
    startDate: "2026-10-15",
    endDate: "2026-11-15",
    neverExpires: false,
    status: "Active",
    createdAt: Date.now() - 10 * 24 * 3600 * 1000,
    updatedAt: Date.now() - 10 * 24 * 3600 * 1000,
  },
];
