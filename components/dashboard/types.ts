export interface OrderCustomer {
  id?: string;
  name: string;
  phone?: string;
  city?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  barcode?: string;
  sku?: string;
  price: number;
  quantity: number;
  total: number;
}

export interface Order {
  id: string;
  billNumber: string;
  storeId: string;
  status: string;
  customer?: OrderCustomer;
  items: OrderItem[];
  totalItemsCount: number;
  subtotal: number;
  discount: number;
  discountType?: string;
  cgst: number;
  sgst: number;
  cgstPercent?: number;
  sgstPercent?: number;
  isPriceInclusiveGst?: boolean;
  roundOff?: number;
  grandTotal: number;
  paymentMethod: "CASH" | "UPI" | "CARD" | "SPLIT";
  splitDetails?: { upi: number; cash: number; card: number } | null;
  notes?: string;
  settledBy?: string;
  createdAt: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  price: number;
  costPrice?: number;
  stock: number;
  barcode?: string;
  sku?: string;
  hasVariations?: boolean;
  variants?: Array<{
    id: string;
    name: string;
    stock: number;
    price: number;
    barcode?: string;
  }>;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  totalSpent?: number;
  totalVisits?: number;
}

export type DateFilterType = "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "ALL";

export interface DashboardStats {
  totalRevenue: number;
  cashRevenue: number;
  upiRevenue: number;
  cardRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  totalTax: number;
  totalDiscount: number;
  totalItemsSold: number;
  uniqueCustomers: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryValue: number;
  cashPercent: number;
  upiPercent: number;
  cardPercent: number;
}
