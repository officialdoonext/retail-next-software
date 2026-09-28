/**
 * NAV PAGES & ACCORDION SIDEBAR CONFIGURATION
 * Single source of truth for the entire software navigation.
 */

export interface NavChildItem {
  id: string;
  label: string;
  href: string;
  description?: string;
}

export interface NavGroupItem {
  id: string;
  label: string;
  icon: string | string[];
  href?: string; // If it is a direct single page (like Dashboard, POS, Stores)
  children?: NavChildItem[]; // If it is an accordion with child pages
}

export const SIDEBAR_NAV: NavGroupItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
  },
  {
    id: "pos",
    label: "POS Billing",
    href: "/pos",
    icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z",
  },
  {
    id: "stores",
    label: "Stores",
    href: "/stores",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  },
  {
    id: "sales-manager",
    label: "Sales Manager",
    icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
    children: [
      { id: "sales", label: "Sales", href: "/sales", description: "All sales transactions & orders" },
      { id: "employee-sales", label: "Employee Sales", href: "/sales/employee-sales", description: "Sales performance by employee" },
      { id: "counter-sales", label: "Counter Sales", href: "/sales/counter-sales", description: "Terminal & counter checkout sales" },
    ],
  },
  {
    id: "product-manager",
    label: "Product Manager",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    children: [
      { id: "categories", label: "Categories", href: "/categories", description: "Organize products into categories" },
      { id: "variations", label: "Variations", href: "/variations", description: "Sizes, colors, units & options" },
      { id: "products", label: "Products", href: "/products", description: "Catalog & item master management" },
      { id: "barcode", label: "Barcode Generator", href: "/barcode", description: "Design, generate & print barcode labels" },
    ],
  },
  {
    id: "return-exchange-manager",
    label: "Return & Exchange Manager",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    children: [
      { id: "returns", label: "Returns", href: "/returns", description: "Customer product returns & credit notes" },
      { id: "exchanges", label: "Exchanges", href: "/returns/exchanges", description: "Item size, color & product exchanges" },
    ],
  },
  {
    id: "stock-manager",
    label: "Stock Manager",
    icon: "M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z",
    children: [
      { id: "warehouse", label: "Warehouse", href: "/stock/warehouse", description: "Central warehouse & facility stocks" },
      { id: "stock", label: "Stock", href: "/stock", description: "Current inventory levels & stock value" },
      { id: "stock-transfers", label: "Stock Transfers", href: "/stock/transfers", description: "Inter-store & warehouse transfers" },
    ],
  },
  {
    id: "customer-manager",
    label: "Customer Manager",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    children: [
      { id: "customer", label: "Customer", href: "/customers", description: "Customer directory & database" },
      { id: "individual-customer", label: "Individual Customer", href: "/customers/individual", description: "Detailed customer profile & purchase history" },
    ],
  },
  {
    id: "discount-manager",
    label: "Discount Manager",
    icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
    children: [
      { id: "order-coupons", label: "Order Coupons", href: "/discounts/order-coupons", description: "Cart-wide discount coupons & codes" },
      { id: "product-coupons", label: "Product Coupons", href: "/discounts/product-coupons", description: "Specific item & category discounts" },
      { id: "customer-coupons", label: "Customer Coupons", href: "/discounts/customer-coupons", description: "Loyalty & personalized coupons" },
    ],
  },
  {
    id: "vendors-manager",
    label: "Vendors Manager",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    children: [
      { id: "vendors", label: "Vendors", href: "/vendors", description: "Suppliers & vendor directory" },
      { id: "vendors-orders", label: "Vendors Orders", href: "/vendors/orders", description: "Purchase orders & goods received" },
      { id: "vendors-invoices", label: "Vendors Invoices", href: "/vendors/invoices", description: "Supplier bills & payment records" },
      { id: "vendors-due", label: "Vendors Due", href: "/vendors/due", description: "Outstanding vendor payables & balances" },
    ],
  },
  {
    id: "staff-manager",
    label: "Staff Manager",
    icon: "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z",
    children: [
      { id: "staff", label: "Staff", href: "/staff", description: "POS terminals, logins & staff permissions" },
    ],
  },
  {
    id: "employee-manager",
    label: "Employee Manager",
    icon: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2",
    children: [
      { id: "employees", label: "Employees", href: "/employees", description: "Employee profiles, designations & records" },
      { id: "employee-attendance", label: "Employee Attendance", href: "/employees/attendance", description: "Clock-in/out, biometric & scan logs" },
      { id: "payroll", label: "Payroll", href: "/employees/payroll", description: "Monthly salaries, payslips & calculations" },
      { id: "id-cards", label: "Id Cards", href: "/employees/id-cards", description: "Badge & printable QR employee ID cards" },
      { id: "employee-leaves", label: "Employee leaves", href: "/employees/leaves", description: "Leave requests, quotas & approvals" },
      { id: "employee-advances", label: "Employee Advances", href: "/employees/advances", description: "Salary advances & deduction ledger" },
    ],
  },
];

// Flattened list of all accessible pages for backwards-compatibility & access checking
export interface NavPage {
  label: string;
  href: string;
  iconPath: string | string[];
}

export const NAV_PAGES: NavPage[] = SIDEBAR_NAV.flatMap((group) => {
  if (group.href) {
    return [{ label: group.label, href: group.href, iconPath: group.icon }];
  }
  if (group.children) {
    return group.children.map((child) => ({
      label: child.label,
      href: child.href,
      iconPath: group.icon,
    }));
  }
  return [];
});
