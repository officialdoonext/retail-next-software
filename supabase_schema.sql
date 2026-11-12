-- ==============================================================================
-- RETAIL NEXT - COMPLETE SUPABASE POSTGRESQL DATABASE SCHEMA
-- MULTI-TENANT ARCHITECTURE: Strictly isolated by business_id
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. BUSINESSES TABLE (Tenants)
-- STRICT RULE: Newly created businesses have status = 'Inactive' and expiry_date = NULL.
-- Only when an administrator manually sets status = 'Active' and unexpired expiry_date
-- will the client be granted access to the software.
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mobile_number TEXT,
  email TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  expiry_date TIMESTAMPTZ DEFAULT NULL,
  plan TEXT DEFAULT NULL,
  max_stores INTEGER DEFAULT 2,
  enabled_modules JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_businesses_email ON public.businesses(email);
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON public.businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON public.businesses(status);

-- 2. STORES TABLE (Branches belonging to a business)
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  phone TEXT,
  mobile_number TEXT,
  city TEXT,
  full_address TEXT,
  location TEXT,
  gst_number TEXT,
  license TEXT,
  status TEXT NOT NULL DEFAULT 'Inactive' CHECK (status IN ('Active', 'Inactive')),
  expires TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_business ON public.stores(business_id);
CREATE INDEX IF NOT EXISTS idx_stores_status ON public.stores(status);

-- 3. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_business ON public.categories(business_id);

-- 4. VARIATIONS TABLE
CREATE TABLE IF NOT EXISTS public.variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  values JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_variations_business ON public.variations(business_id);

-- 4b. WAREHOUSES TABLE (Central storage facilities & distribution depots)
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mobile_number TEXT,
  phone TEXT,
  city TEXT,
  address TEXT,
  full_address TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_business ON public.warehouses(business_id);

-- 5. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  short_code TEXT,
  sku TEXT,
  barcode TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  category_name TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  mrp NUMERIC(12, 2) DEFAULT 0.00,
  stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  min_stock NUMERIC(12, 2) DEFAULT 0.00,
  unit TEXT DEFAULT 'pcs',
  tax_rate NUMERIC(5, 2) DEFAULT 0.00,
  images JSONB DEFAULT '[]'::jsonb,
  has_variations BOOLEAN DEFAULT false,
  variation_options JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_business ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);

-- 6. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  gst_number TEXT,
  total_purchases NUMERIC(12, 2) DEFAULT 0.00,
  loyalty_points NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_business ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);

-- 7. ORDERS & SALES TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method TEXT DEFAULT 'Cash',
  payment_status TEXT DEFAULT 'Paid',
  status TEXT DEFAULT 'Completed',
  staff_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_business ON public.orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at);

-- 8. STAFF TABLE
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  mpin TEXT NOT NULL,
  role TEXT DEFAULT 'Staff',
  access JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_business ON public.staff(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_mobile ON public.staff(mobile);

-- 9. EMPLOYEES & HR MANAGEMENT
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id TEXT,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  city TEXT,
  address TEXT,
  salary_type TEXT DEFAULT 'monthly',
  salary_amount NUMERIC(12, 2) DEFAULT 0.00,
  accepted_leaves INTEGER DEFAULT 0,
  emergency_name TEXT,
  emergency_relation TEXT,
  emergency_contact_number TEXT,
  avatar_url TEXT,
  qr_code_url TEXT,
  status TEXT DEFAULT 'Active',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_business ON public.employees(business_id);
CREATE INDEX IF NOT EXISTS idx_employees_store ON public.employees(store_id);
CREATE INDEX IF NOT EXISTS idx_employees_emp_id ON public.employees(employee_id);

-- Safely add columns if employees table was already created with older schema
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_type TEXT DEFAULT 'monthly';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS salary_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS accepted_leaves INTEGER DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_relation TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS qr_code_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  employee_numeric_id TEXT,
  employee_name TEXT,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  is_leave BOOLEAN DEFAULT false,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_att_store_emp_date UNIQUE (store_id, employee_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_business ON public.employee_attendance(business_id);
CREATE INDEX IF NOT EXISTS idx_attendance_store_date ON public.employee_attendance(store_id, date);

CREATE TABLE IF NOT EXISTS public.employee_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  employee_numeric_id TEXT,
  employee_name TEXT,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  days_count INTEGER DEFAULT 1,
  reason TEXT,
  status TEXT DEFAULT 'Approved',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaves_business ON public.employee_leaves(business_id);
CREATE INDEX IF NOT EXISTS idx_leaves_store ON public.employee_leaves(store_id);

CREATE TABLE IF NOT EXISTS public.employee_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  employee_numeric_id TEXT,
  employee_name TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  date DATE NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'Pending',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advances_business ON public.employee_advances(business_id);
CREATE INDEX IF NOT EXISTS idx_advances_store ON public.employee_advances(store_id);

CREATE TABLE IF NOT EXISTS public.employee_repayments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  employee_numeric_id TEXT,
  employee_name TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  date DATE NOT NULL,
  notes TEXT,
  settlement_summary JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repayments_business ON public.employee_repayments(business_id);
CREATE INDEX IF NOT EXISTS idx_repayments_store ON public.employee_repayments(store_id);

CREATE TABLE IF NOT EXISTS public.employee_payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  records JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_store_month UNIQUE (store_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_business ON public.employee_payroll(business_id);
CREATE INDEX IF NOT EXISTS idx_payroll_store_month ON public.employee_payroll(store_id, month);

CREATE TABLE IF NOT EXISTS public.store_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holidays_business ON public.store_holidays(business_id);
CREATE INDEX IF NOT EXISTS idx_holidays_store ON public.store_holidays(store_id);

-- 10. UTILITIES: GODOWNS, RACKS, SERIAL NUMBERS & SAVED BILLS
CREATE TABLE IF NOT EXISTS public.godowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.racks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  godown_id UUID REFERENCES public.godowns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.serial_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  numeric_value INTEGER,
  created_by TEXT,
  status TEXT DEFAULT 'Available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.serial_numbers ADD COLUMN IF NOT EXISTS numeric_value INTEGER;
ALTER TABLE public.serial_numbers ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE TABLE IF NOT EXISTS public.saved_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  bill_name TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_info JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_business_store_settings UNIQUE (business_id, store_id)
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.godowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Allow service role full bypass (used by Next.js backend server)
DROP POLICY IF EXISTS "Service role full access on businesses" ON public.businesses;
CREATE POLICY "Service role full access on businesses"
  ON public.businesses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view, insert & update their own business records
DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses;
CREATE POLICY "Users can view their own businesses"
  ON public.businesses FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id OR email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "Users can create their own businesses" ON public.businesses;
CREATE POLICY "Users can create their own businesses"
  ON public.businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id OR email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "Users can update their own businesses" ON public.businesses;
CREATE POLICY "Users can update their own businesses"
  ON public.businesses FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id OR email = auth.jwt() ->> 'email')
  WITH CHECK (auth.uid() = owner_id OR email = auth.jwt() ->> 'email');

-- ==============================================================================
-- 18. COUPONS & DISCOUNTS TABLE
-- Supports Order Coupons, Product/BOGO Deals, and Customer/VIP Vouchers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order', 'product', 'customer')),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat', 'bogo', 'bundle')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  max_discount_cap NUMERIC,
  min_order_value NUMERIC DEFAULT 0,
  
  -- Product coupon rules
  target_type TEXT DEFAULT 'all',
  target_product_ids JSONB DEFAULT '[]'::jsonb,
  target_category_ids JSONB DEFAULT '[]'::jsonb,
  bogo_buy_qty INTEGER,
  bogo_get_qty INTEGER,
  bogo_discount_percent NUMERIC DEFAULT 100,
  bundle_qty INTEGER,
  bundle_price NUMERIC,

  -- Customer coupon rules
  customer_scope TEXT DEFAULT 'all',
  target_customer_phones JSONB DEFAULT '[]'::jsonb,
  target_customer_group TEXT,
  milestone_type TEXT,
  is_single_use_per_customer BOOLEAN DEFAULT true,

  -- Limits & Payments
  total_usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  allowed_payment_modes JSONB DEFAULT '["All"]'::jsonb,
  exclude_sale_items BOOLEAN DEFAULT false,
  auto_apply_at_checkout BOOLEAN DEFAULT false,

  -- Dates & Status
  start_date DATE,
  start_time TEXT,
  end_date DATE,
  end_time TEXT,
  never_expires BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Scheduled', 'Expired')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_business_coupon_code UNIQUE (business_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_business ON public.coupons(business_id);
CREATE INDEX IF NOT EXISTS idx_coupons_store ON public.coupons(store_id);
CREATE INDEX IF NOT EXISTS idx_coupons_type ON public.coupons(type);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON public.coupons(status);

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated access to coupons" ON public.coupons;
CREATE POLICY "Allow authenticated access to coupons"
  ON public.coupons FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- HELPER FUNCTION FOR MANUAL BUSINESS ACTIVATION BY SUPERADMIN
-- To activate a business and set expiry date:
-- SELECT activate_business('<business-uuid>', '2027-12-31 23:59:59+00', 'Active');
-- ==============================================================================
CREATE OR REPLACE FUNCTION activate_business(
  target_business_id UUID,
  new_expiry TIMESTAMPTZ,
  new_status TEXT DEFAULT 'Active'
) RETURNS VOID AS $$
BEGIN
  UPDATE public.businesses
  SET status = new_status,
      expiry_date = new_expiry,
      updated_at = now()
  WHERE id = target_business_id;

  -- Also activate associated stores
  UPDATE public.stores
  SET status = new_status,
      expires = new_expiry,
      updated_at = now()
  WHERE business_id = target_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- DATABASE PERMISSIONS & ROLE GRANTS (CRITICAL FOR SUPABASE)
-- PostgREST connects via the 'authenticator' role and assumes 'anon',
-- 'authenticated', or 'service_role'. They must have USAGE on schema public
-- and privileges on all tables and sequences to prevent "permission denied" errors.
-- ==============================================================================
-- ==============================================================================
-- 19. VENDORS & SUPPLIERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  email TEXT,
  gst_number TEXT,
  address TEXT,
  city TEXT,
  outstanding_due NUMERIC(12, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendors_business ON public.vendors(business_id);
CREATE INDEX IF NOT EXISTS idx_vendors_store ON public.vendors(store_id);

-- 20. VENDOR ORDERS (Purchase Orders)
CREATE TABLE IF NOT EXISTS public.vendor_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  po_number TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  expected_delivery DATE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Shipped', 'Received', 'Cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_orders_business ON public.vendor_orders(business_id);
CREATE INDEX IF NOT EXISTS idx_vendor_orders_po ON public.vendor_orders(po_number);

-- 21. VENDOR INVOICES (Supplier Bills & Payments)
CREATE TABLE IF NOT EXISTS public.vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method TEXT DEFAULT 'Bank Transfer',
  status TEXT DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partially Paid', 'Paid', 'Overdue')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_business ON public.vendor_invoices(business_id);

-- 22. STOCK TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  from_type TEXT NOT NULL DEFAULT 'Store', -- 'Store' | 'Warehouse'
  from_id TEXT NOT NULL,
  from_name TEXT NOT NULL,
  to_type TEXT NOT NULL DEFAULT 'Store', -- 'Store' | 'Warehouse'
  to_id TEXT NOT NULL,
  to_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_qty NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In-Transit', 'Received', 'Cancelled')),
  notes TEXT,
  transferred_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_business ON public.stock_transfers(business_id);

-- Enable RLS on new tables
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- UNIVERSAL PERMISSIONS & RLS POLICIES FOR ALL TABLES
-- Grants permissions and creates bypass policies for service_role and authenticated users.
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- Ensure service_role and authenticated users have full access across all tables under RLS
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role bypass %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Service role bypass %I" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access %I" ON public.%I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow authenticated full access %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END $$;
