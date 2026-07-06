-- 1. Update equipment table
ALTER TABLE equipment RENAME COLUMN code TO item_code;
ALTER TABLE equipment DROP COLUMN IF EXISTS serial_number;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS critical_level INTEGER DEFAULT 0;

-- 2. Update bundle_items table
ALTER TABLE bundle_items RENAME COLUMN code TO item_code;
ALTER TABLE bundle_items DROP COLUMN IF EXISTS serial_number;

-- 2.1 Update request_items table for consistency
ALTER TABLE request_items RENAME COLUMN code TO item_code;

-- 3. Create item_serials table
CREATE TABLE IF NOT EXISTS item_serials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_code TEXT NOT NULL REFERENCES equipment(item_code),
  serial_number TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  status TEXT DEFAULT 'Available',
  request_id TEXT, -- Link to item_requests.control_no
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_item_serials_item_code ON item_serials(item_code);
CREATE INDEX IF NOT EXISTS idx_item_serials_location ON item_serials(location);

-- 4. Fix schools batch upload
-- First, ensure customer_code is unique (may require cleaning duplicates first if they exist)
ALTER TABLE schools ADD CONSTRAINT schools_customer_code_unique UNIQUE (customer_code);

-- 5. Create school_monitoring table
CREATE TABLE IF NOT EXISTS school_monitoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_code TEXT UNIQUE NOT NULL,
  school_name TEXT NOT NULL,
  program TEXT,
  sales_team TEXT,
  class_opening DATE,
  target_deployment_date DATE,
  status INTEGER DEFAULT 1,
  status_dates JSONB,
  items JSONB,
  school_monitoring_id TEXT,
  type_of_document TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create delivery_receipts table
CREATE TABLE IF NOT EXISTS delivery_receipts (
  id TEXT PRIMARY KEY, -- The DR No (e.g. 002606-49293)
  school_name TEXT NOT NULL,
  client_code TEXT,
  agent TEXT,
  project TEXT,
  date DATE,
  status TEXT DEFAULT 'Ready for delivery',
  in_transit_date DATE,
  delivered_date DATE,
  target_delivery_date DATE,
  total_items INTEGER DEFAULT 0,
  issued_by TEXT,
  delivered_by TEXT,
  received_by TEXT,
  remarks TEXT,
  hardware_items JSONB,
  service_items JSONB,
  signatory_prepared JSONB,
  signatory_approved JSONB,
  signatory_delivered JSONB,
  signatory_checked_received JSONB,
  address TEXT,
  contact_person TEXT,
  contact_no TEXT,
  moa TEXT,
  delivery_history JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ALTER statements to add missing columns if they already exist
ALTER TABLE school_monitoring ADD COLUMN IF NOT EXISTS school_monitoring_id TEXT;
ALTER TABLE school_monitoring ADD COLUMN IF NOT EXISTS type_of_document TEXT;

ALTER TABLE item_requests ADD COLUMN IF NOT EXISTS school_monitoring_id TEXT;

-- Drop check constraint on school_monitoring.program to allow any exact program selection (e.g., TNL, NGS+ACE, etc.)
ALTER TABLE school_monitoring DROP CONSTRAINT IF EXISTS school_monitoring_program_check;


