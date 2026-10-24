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
-- Allow authenticated users to view & insert their own business records
DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses;
CREATE POLICY "Users can view their own businesses"
  ON public.businesses FOR SELECT
  USING (auth.uid() = owner_id OR email = auth.jwt() ->> 'email');

DROP POLICY IF EXISTS "Users can create their own businesses" ON public.businesses;
CREATE POLICY "Users can create their own businesses"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR email = auth.jwt() ->> 'email');

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
