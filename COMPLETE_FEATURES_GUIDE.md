# Retail Next POS & Retail ERP — Complete Feature & Operations Manual

> **System Version:** Retail Next Enterprise Suite 2026.1  
> **Primary Brand Theme:** Royal Indigo / Purple (`#5e2b9d`) & Slate System Palette  
> **Data Architecture:** 100% Dynamic PostgreSQL Database (Supabase REST APIs), zero mock data, standardized 24-item pagination.

---

## Table of Contents
1. [System Architecture & Design Language](#1-system-architecture--design-language)
2. [Executive Dashboard (`/dashboard`)](#2-executive-dashboard-dashboard)
3. [Point of Sale (POS) Billing Engine (`/pos`)](#3-point-of-sale-pos-billing-engine-pos)
4. [Returns & Product Exchanges](#4-returns--product-exchanges)
   - [Product Returns Terminal (`/returns`)](#41-product-returns-terminal-returns)
   - [Product Exchanges Terminal (`/returns/exchanges`)](#42-product-exchanges-terminal-returnsexchanges)
5. [Sales Register & Transaction Ledgers](#5-sales-register--transaction-ledgers)
   - [All Sales Register (`/sales`)](#51-all-sales-register-sales)
   - [Counter Sales & Register Balancing (`/sales/counter-sales`)](#52-counter-sales--register-balancing-salescounter-sales)
   - [Employee Sales Performance (`/sales/employee-sales`)](#53-employee-sales-performance-salesemployee-sales)
6. [Customer Relationship Management (CRM)](#6-customer-relationship-management-crm)
   - [Customer Directory (`/customers`)](#61-customer-directory-customers)
   - [Individual Customer 360° Profile (`/customers/individual`)](#62-individual-customer-360-profile-customersindividual)
7. [Product Catalog & Variation Matrix](#7-product-catalog--variation-matrix)
   - [Master Products Catalog (`/products`)](#71-master-products-catalog-products)
   - [Categories & Subcategories (`/categories`)](#72-categories--subcategories-categories)
   - [Product Variations (`/variations`)](#73-product-variations-variations)
8. [Barcode & Price Label Studio (`/barcode`)](#8-barcode--price-label-studio-barcode)
9. [Discounts, Coupons & Loyalty Engine (`/discounts`)](#9-discounts-coupons--loyalty-engine-discounts)
   - [Order / Bill Coupons (`/discounts/order-coupons`)](#91-order--bill-coupons-discountsorder-coupons)
   - [Product Coupons (`/discounts/product-coupons`)](#92-product-coupons-discountsproduct-coupons)
   - [Customer Loyalty Coupons (`/discounts/customer-coupons`)](#93-customer-loyalty-coupons-discountscustomer-coupons)
10. [Inventory, Stock Transfers & Warehouses](#10-inventory-stock-transfers--warehouses)
    - [Stock Overview & Inventory Audit (`/stock` & `/inventory`)](#101-stock-overview--inventory-audit-stock--inventory)
    - [Inter-Store Stock Transfers (`/stock/transfers`)](#102-inter-store-stock-transfers-stocktransfers)
    - [Warehouse & Storage Bin Control (`/warehouse` & `/stock/warehouse`)](#103-warehouse--storage-bin-control-warehouse--stockwarehouse)
    - [Stock Analytics & Velocity (`/stock-analysis`)](#104-stock-analytics--velocity-stock-analysis)
11. [Vendor Management & Procurement (`/vendors`)](#11-vendor-management--procurement-vendors)
    - [Supplier Directory (`/vendors`)](#111-supplier-directory-vendors)
    - [Purchase Orders (`/vendors/orders`)](#112-purchase-orders-vendorsorders)
    - [Goods Received Notes & Inward Invoices (`/vendors/invoices`)](#113-goods-received-notes--inward-invoices-vendorsinvoices)
    - [Vendor Outstandings & Dues (`/vendors/due`)](#114-vendor-outstandings--dues-vendorsdue)
12. [Human Resources & Payroll (`/employees` & `/staff`)](#12-human-resources--payroll-employees--staff)
    - [Employee Directory (`/employees`)](#121-employee-directory-employees)
    - [Attendance & QR Terminal Scanner (`/employees/attendance` & `/attendance-scan`)](#122-attendance--qr-terminal-scanner-employeesattendance--attendance-scan)
    - [Leave Management (`/employees/leaves`)](#123-leave-management-employeesleaves)
    - [Salary Advances & Deductions (`/employees/advances`)](#124-salary-advances--deductions-employeesadvances)
    - [Automated Payroll Generation (`/employees/payroll`)](#125-automated-payroll-generation-employeespayroll)
    - [Employee ID Card Studio (`/employees/id-cards` & `/employees/id-card`)](#126-employee-id-card-studio-employeesid-cards--employeesid-card)
13. [Business Intelligence & Tax Reports (`/analytics`)](#13-business-intelligence--tax-reports-analytics)
14. [Store Setup & Global Preferences (`/stores` & `/settings`)](#14-store-setup--global-preferences-stores--settings)
15. [System Utilities & Data Tools (`/utilities`)](#15-system-utilities--data-tools-utilities)

---

## 1. System Architecture & Design Language

### Core Design Standards
- **Primary Brand Color:** `#5e2b9d` (Tailwind shades: `#4e2284` active hover, `purple-50` background accents).
- **Secondary Status Accents:**
  - Emerald (`#10b981` / `emerald-700`): Successful bills, active stock, cash tender, active credits.
  - Rose (`#e11d48` / `rose-600`): Product returns, refunds, out-of-stock items, urgent alerts.
  - Indigo / Purple (`#6366f1` / `#5e2b9d`): Product exchanges, exchange vouchers, store credit.
  - Sky Blue (`#0ea5e9`): UPI / digital QR payments, system notifications.
  - Amber (`#f59e0b`): Low stock alerts, card payments, draft bills.
- **Data Integrity:** **100% Dynamic**. All figures, counts, lists, and metrics are queried directly from Supabase PostgreSQL tables without mock arrays or hardcoded lists.
- **Unified List Pagination:** All lists, registers, tables, and directories enforce **24 items per page** with dynamic first/prev/page/next/last controls and total item counters.

---

## 2. Executive Dashboard (`/dashboard`)

The command center for store owners, managers, and retail supervisors, providing live consolidated operations metrics.

### Key Capabilities
- **Real-Time KPI Cards:**
  - **Gross Revenue & Net Sales:** Filtered by current period with previous period comparison.
  - **Tender Breakdown:** Real-time split across Cash, UPI, and Card.
  - **Orders Count & Velocity:** Total bills settled and average order value (AOV).
  - **Customer Reach:** Total unique customers served during the selected window.
  - **Tax & Discount Tracking:** Cumulative GST liability and store-wide promotional discounts.
  - **Catalog Valuation:** Current retail stock valuation, low stock warnings, and out-of-stock alerts.
- **Date Range Filters:** Instant filtering for **Today**, **Yesterday**, **Last 7 Days**, **Last 30 Days**, **This Month**, and **All Time**.
- **Interactive Visual Analytics:**
  1. *Revenue & Order Velocity Trend:* Dual-axis Area/Composed chart tracking daily revenues against billing counts.
  2. *Payment Tender Breakdown:* Donut chart visualizing tender distribution with dynamic percentage shares.
  3. *Hourly Velocity Matrix:* 12-hour bar chart highlighting store peak hours and rush periods.
  4. *Top Best-Selling Products:* Progress bar leaderboard ranked by revenue and units sold.
  5. *Category Market Share:* Donut chart of revenue contribution by category.
  6. *Day-of-Week Sales Velocity:* Weekly revenue comparison across Monday through Sunday.
  7. *Tax & Discount Financial Stack:* Stacked bar analysis of item subtotal vs GST tax vs store discounts.
  8. *Cashier Performance Leaderboard:* Operator-level billing counts and gross collections.
  9. *Inventory Stock Health:* Pie chart categorizing healthy stock, low stock ($\le 5$), and stock-outs.
- **Recent Transactions Register:** Shows the latest 24 orders with customer names, items count, grand totals, and tender badges, linking directly to the full sales register.

---

## 3. Point of Sale (POS) Billing Engine (`/pos`)

High-velocity counter checkout terminal engineered for rapid touch/barcode retail operations.

### Key Capabilities
- **Barcode & Instant SKU Lookup:**
  - Fast barcode input with auto-add on barcode scanner Enter trigger.
  - Live search input searching product titles, SKUs, and barcodes simultaneously.
  - Visual product grid with category quick-pills, stock badges, selling prices, and MRP comparison.
- **Cart Management:**
  - Incremental quantity stepper (`+` / `-` / direct input).
  - Inline price override with cashier authorization.
  - Tax-inclusive and tax-exclusive automated computation.
  - Employee/salesperson tagging per line item for sales incentive tracking.
- **Customer Assignment & Quick Create:**
  - Instant mobile number or customer name autocomplete.
  - In-place quick customer creation modal (Name, Mobile, Address).
  - Displays customer loyalty points balance and credit status.
- **Automated Exchange Credit Redemption Banner:**
  - Detects if the assigned customer holds unused product exchange credit from previous returns.
  - Displays an interactive banner: `"Active Exchange Credit Found: ₹X (Voucher #EXC-...)"`.
  - Cashier can click **"Apply Exchange Credit"** to immediately deduct the credit from the bill total, or click dismiss to ignore.
  - Automatically links the previous bill reference into the new invoice.
- **Coupons & Discount Rules:**
  - Real-time coupon validation for Order Coupons, Product Coupons, and Customer Loyalty Coupons.
  - Displays net discount savings in real time.
- **Multi-Tender Settlement System:**
  - **Cash:** Tendered amount input with instant change calculation.
  - **UPI:** Dynamic or static QR display with reference transaction code input.
  - **Card:** Debit / Credit card terminal slip reference tracking.
  - **Split Tender:** Seamless combinations of Cash + UPI + Card with residual balance indicator.
- **Draft Bills (Hold & Recall):**
  - Suspend an active cart to attend to another customer in line.
  - Quick-access drawer listing active draft bills with timestamps, items count, and one-click restore.
- **Receipt Printing & Reprints:**
  - Dual print templates: 3-inch (80mm) / 2-inch (58mm) Thermal Receipt or A4 GST Tax Invoice.
  - Includes store logo, address, GSTIN, invoice barcode, line item tax rate, cashier name, and return policy.

---

## 4. Returns & Product Exchanges

Full reverse logistics cycle with automatic stock replenishment and ledger linking.

### 4.1 Product Returns Terminal (`/returns`)
- **Bill Search & Lookup:** Search customer bills by Bill Number or Customer Mobile Number (fetches latest 10 bills).
- **Itemized Return Selection:** Select exactly which items and what quantity are being returned.
- **Reason Input:** Free-text `<input type="text">` accompanied by quick-tag buttons (*Defective Fabric, Wrong Size, Customer Choice, Color Mismatch*).
- **Automatic Stock Replenishment:** Returned items are immediately restocked into the product catalog in the database.
- **Refund Settlement:** Choose between Cash Refund, UPI Transfer, Store Credit, or Original Card Reverse.
- **Return Bill Printing:** Generates a formal Return Credit Note with return transaction ID (e.g. `RET-...`).

### 4.2 Product Exchanges Terminal (`/returns/exchanges`)
- **Simplified Direct Exchange:** Allows cashiers to accept exchanged goods without being forced to choose replacement items immediately.
- **Exchange Voucher Generation:** Issues an Exchange Voucher / Slip with unique ID (e.g. `EXC-...`) with initial status `ACTIVE`.
- **Immediate Stock Restocking:** Restores the exchanged merchandise back into active inventory.
- **Seamless POS Redemption:** The generated exchange voucher is linked to the customer and automatically surfaces during their next billing session at `/pos` to reduce their payable total.

---

## 5. Sales Register & Transaction Ledgers

### 5.1 All Sales Register (`/sales`)
- **Complete Invoices Register:** Lists all completed store transactions paginated at 24 records per page.
- **Deep Filtering & Search:**
  - Filter by date presets (Today, Yesterday, Last 7 Days, Last 30 Days, This Month, or Custom Date Range).
  - Search by Invoice Number, Customer Name, or Phone Number.
  - Filter by Payment Tender (Cash, UPI, Card, Split).
- **Bill Type Badges:**
  - `Walk-in Bill`: Standard retail sales (emerald badge).
  - `Exchange Bill`: Replacement bill issued against previous exchange credit, displaying linked reference `Ref: #{previousBillNumber}` (purple badge).
  - `Exchange Slip`: Credit voucher issued upon receiving merchandise for exchange.
  - `Return Bill`: Refund transaction (rose badge).
- **Exchange & Return Details Column:**
  - Calculates all reverse transactions logged against each original bill.
  - Displays detailed status badges:
    - `↩ X Returned` (with tooltip showing returned product names)
    - `⇄ Y Exchanged` (with tooltip showing exchanged product names)
    - `None (0 Ret / 0 Exc)` when no items have been returned or exchanged.
- **Actions:** View full invoice modal, reprint thermal slip, or print A4 invoice.

### 5.2 Counter Sales & Register Balancing (`/sales/counter-sales`)
- Shift opening float declaration, counter drawer tracking, and end-of-day register closing.
- Compares expected cash collections from software receipts against physical drawer counts.

### 5.3 Employee Sales Performance (`/sales/employee-sales`)
- Breakdown of sales revenue generated per salesperson.
- Average bill value and sales volume per staff member for commission/incentive calculations.

---

## 6. Customer Relationship Management (CRM)

### 6.1 Customer Directory (`/customers`)
- **Searchable Customer Database:** 24 records per page with search by Name, Phone, Email, or Customer Code.
- **Customer Master Data:**
  - Personal Details: Name, Mobile, Landline, Email, Full Address, City, PIN.
  - Financial & Tax: GSTIN, State / Place of Supply, Credit Limit, Credit Days, Opening Balance.
  - Segmentation: Customer Group, Classification, Discount %, Stop Credit switch.
- **Quick Bill Action:** Single-click launcher opening POS billing with customer preloaded.

### 6.2 Individual Customer 360° Profile (`/customers/individual`)
Comprehensive customer overview with URL parameter deep-linking (`?id=...`, `?phone=...`, `?tab=...`).
- **Header Stat Cards:** Total Purchases (₹), Orders Count, Returns Count, Exchanges Count, and Loyalty Points.
- **4 Dedicated Standalone Tabs:**
  1. **Customer Profile Details:** Complete address, credit parameters, tax data, and communication preferences.
  2. **Orders & Bills ({count}):** Paginated list of all customer invoices with item breakdowns, amounts, payment modes, and invoice preview modal.
  3. **Returns Tab ({count}):** Dedicated view of all product returns logged by this customer, total refund disbursed (₹), items returned count, search filter, and `+ Record Return` button.
  4. **Exchanges Tab ({count}):** Dedicated exchange ledger showing all exchange vouchers issued, total exchange credit, active redeemable balance, voucher status (`ACTIVE CREDIT` or `REDEEMED IN BILL`), and `+ New Exchange Voucher` button.

---

## 7. Product Catalog & Variation Matrix

### 7.1 Master Products Catalog (`/products`)
- **Inventory Directory:** 24 items per page with search across Title, SKU, Barcode, and Brand.
- **Stock Filtering:** Filter by Category or Stock Status (In Stock, Low Stock $\le 5$, Out of Stock).
- **Add / Edit Product Modal:**
  - Basic Info: Title, SKU, Barcode, Category, Brand, Description, Image.
  - Pricing & GST: Cost Price, Selling Price (List Price), MRP, GST Rate (0%, 5%, 12%, 18%, 28%), Tax Inclusion flag.
  - Inventory Controls: Current Stock, Low Stock Reorder Threshold, Unit of Measurement (Pcs, Box, Kg).
- **Bulk Quick Actions:** Stock level adjustments and direct barcode sticker printing.

### 7.2 Categories & Subcategories (`/categories`)
- Organize catalog into hierarchical categories.
- Assign default GST tax brackets to categories for automatic tax calculation during product creation.

### 7.3 Product Variations (`/variations`)
- Manage multi-variant products across Sizes (S, M, L, XL, XXL), Colors, Fabrics, and Fits.
- Generates distinct SKUs and barcodes per variant size/color permutation.

---

## 8. Barcode & Price Label Studio (`/barcode`)

- **Custom Label Designer:** Create barcode sticker templates with store name, product title, SKU, barcode graphic, MRP, sale price, and size/variant tags.
- **Supported Barcode Types:** Code 128, EAN-13, and QR Codes.
- **Multi-Paper Support:** Pre-configured layouts for thermal roll labels (38x25mm, 50x25mm, 50x50mm) and A4 sheets (24-up, 48-up labels).
- **Batch Printing:** Bulk print barcode labels from recent stock inward receipts or specific product selections.

---

## 9. Discounts, Coupons & Loyalty Engine (`/discounts`)

### 9.1 Order / Bill Coupons (`/discounts/order-coupons`)
- Create promotional coupon codes applied at checkout (e.g. `FESTIVE20`, `FLAT500`).
- Rules: Flat Amount (₹) or Percentage (%), Minimum Cart Value, Maximum Discount Cap, Usage Limit per Customer, and Expiry Date.

### 9.2 Product Coupons (`/discounts/product-coupons`)
- Item-specific or category-specific discounts (e.g. "Buy 2 Get 10% off Jeans").

### 9.3 Customer Loyalty Coupons (`/discounts/customer-coupons`)
- Exclusive VIP coupons restricted to specific customer groups or individual customer mobile numbers.

---

## 10. Inventory, Stock Transfers & Warehouses

### 10.1 Stock Overview & Inventory Audit (`/stock` & `/inventory`)
- Real-time inventory audit dashboard displaying total SKUs, total units on hand, total inventory value at cost, and total retail valuation.
- Low stock reorder alerts and negative stock prevention.

### 10.2 Inter-Store Stock Transfers (`/stock/transfers`)
- Transfer stock between multiple store branches or central warehouse to retail stores.
- Workflow: Transfer Request $\rightarrow$ Dispatch Note $\rightarrow$ Goods in Transit $\rightarrow$ Receiving Store Verification & Inward.

### 10.3 Warehouse & Storage Bin Control (`/warehouse` & `/stock/warehouse`)
- Multi-warehouse location tracking (Central Depot, Annex Warehouse, Store Backroom).
- Bin, rack, and shelf assignment for rapid picking and physical inventory counts.

### 10.4 Stock Analytics & Velocity (`/stock-analysis`)
- Fast-Moving vs Slow-Moving analysis (FSN matrix).
- ABC Analysis based on revenue generation.
- Dead stock reports identifying items with zero sales in 60/90 days.

---

## 11. Vendor Management & Procurement (`/vendors`)

### 11.1 Supplier Directory (`/vendors`)
- Vendor profiles with contact person, phone, email, full address, GSTIN, PAN, and credit terms.
- Vendor ledger balance showing running account dues and payment history.

### 11.2 Purchase Orders (`/vendors/orders`)
- Create and issue formal Purchase Orders (POs) with itemized quantities, expected delivery dates, and negotiated rates.
- PO lifecycle tracking: Draft $\rightarrow$ Sent $\rightarrow$ Partially Received $\rightarrow$ Completed $\rightarrow$ Cancelled.

### 11.3 Goods Received Notes & Inward Invoices (`/vendors/invoices`)
- Inward stock against vendor bills (GRN).
- Automatically updates product stock quantities upon invoice confirmation.
- Calculates input tax credit (ITC) for GST accounting.

### 11.4 Vendor Outstandings & Dues (`/vendors/due`)
- Payables dashboard showing vendor invoices due, aging brackets (0-30 days, 31-60 days, 60+ days), and payment disbursement logging.

---

## 12. Human Resources & Payroll (`/employees` & `/staff`)

### 12.1 Employee Directory (`/employees`)
- Full employee profile: Name, Mobile, Email, Designation, Department, Date of Joining, Basic Salary, Bank Account details, and Emergency Contact.

### 12.2 Attendance & QR Terminal Scanner (`/employees/attendance` & `/attendance-scan`)
- Daily attendance ledger tracking In-Time, Out-Time, Total Hours, and Status (Present, Late, Half Day, Absent).
- **Attendance Scan Kiosk (`/attendance-scan`):** Dedicated camera/scanner page where employees scan their ID card barcode/QR to log clock-in and clock-out automatically.

### 12.3 Leave Management (`/employees/leaves`)
- Track leave balances (Casual Leave, Sick Leave, Earned Leave).
- Apply, approve, or reject employee leave requests with automated salary deduction linkage.

### 12.4 Salary Advances & Deductions (`/employees/advances`)
- Record salary advances disbursed to staff via Cash or UPI.
- Tracks repayment installments and auto-deducts balance during monthly payroll runs.

### 12.5 Automated Payroll Generation (`/employees/payroll`)
- One-click monthly salary generation.
- Computes gross salary, attendance days, leave deductions, advance repayments, bonuses, and net payable salary.
- Generates printable employee salary slips.

### 12.6 Employee ID Card Studio (`/employees/id-cards` & `/employees/id-card`)
- Instant generator for printable staff ID cards with employee photo, numeric ID, barcode, designation, and company logo.

---

## 13. Business Intelligence & Tax Reports (`/analytics`)

- **GSTR-1 Tax Summary:** Taxable value, CGST, SGST, IGST totals grouped by tax slabs (0%, 5%, 12%, 18%, 28%) for easy GST filing.
- **Sales Velocity by Category & Product:** Detailed profitability and margin analysis per line of business.
- **Hourly Peak Traffic Report:** Identifies store busiest hours to optimize staff scheduling.

---

## 14. Store Setup & Global Preferences (`/stores` & `/settings`)

### 14.1 Store Manager (`/stores`)
- Configure multiple store branches, assign active store, set branch-specific GSTIN, phone, address, and receipt footers.

### 14.2 Settings & Configuration (`/settings`)
- **Store Profile:** Legal business name, trade name, GSTIN, logo upload.
- **Billing Preferences:** Default tax inclusion, auto-print receipts, barcode scanner settings.
- **Printer Configurations:** Thermal printer page width (58mm vs 80mm), margin offsets, cash drawer kick pulse.

---

## 15. System Utilities & Data Tools (`/utilities`)

- Database backup export and catalog import utilities (CSV / Excel).
- System cache clearing and offline synchronization health monitor.

---
*Document automatically compiled for Retail Next Enterprise Suite. All features, workflows, and routes verified.*

