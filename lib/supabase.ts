
import { createClient } from '@supabase/supabase-js';

/**
 * --- SUPABASE CONNECTION CONFIGURATION ---
 */

// 1. Paste your Project URL here
const YOUR_SUPABASE_URL = 'https://syqdbndqbmuyznsmgjzz.supabase.co'; 

// 2. Paste your Anon Public Key here
const YOUR_SUPABASE_ANON_KEY = 'sb_publishable_QdLcP4n8-0jMUuepVPKq6g_mn-CE8vo';

const envUrl = process.env.SUPABASE_URL;
const envKey = process.env.SUPABASE_ANON_KEY;

const finalUrl = (envUrl && envUrl !== '') ? envUrl : YOUR_SUPABASE_URL;
const finalKey = (envKey && envKey !== '') ? envKey : YOUR_SUPABASE_ANON_KEY;

const isConfigured = 
  finalUrl.startsWith('https://') && 
  !finalUrl.includes('your-project-id') && 
  finalKey.length > 20 &&
  finalKey !== 'your-anon-key-here';

export const supabase = createClient(
  isConfigured ? finalUrl : 'https://placeholder.supabase.co', 
  isConfigured ? finalKey : 'placeholder-key'
);

export const isSupabaseConfigured = isConfigured;

/**
 * --- FINAL SQL SCHEMA FOR INVENTORY LOCATIONS ---
 * 
 * -- 1. UPDATE STATUS COLUMN TO DEFAULT NULL --
 * ALTER TABLE request_items ALTER COLUMN status SET DEFAULT NULL;
 * ALTER TABLE request_items ALTER COLUMN status DROP NOT NULL;
 * 
 * =========================================================
 * -- DATABASE VIEW: view_inventory_by_location --
 * =========================================================
 * 
 * DROP VIEW IF EXISTS view_inventory_by_location;
 * 
 * CREATE OR REPLACE VIEW view_inventory_by_location AS
 * SELECT 
 *     ri.id as item_uuid,
 *     ir.control_no as request_id,
 *     ri.code as "IDENTIFIER",
 *     ri.item as "SPECIFICATION",
 *     ri.qty as quantity_val,
 *     ri.uom as unit_measure,
 *     ri.status as "STATUS", -- Removing COALESCE to allow 'Empty' state detection
 *     ir.location as location_name,
 *     ir.school_name as school_name,
 *     ir.ticket_no as ticket_reference
 * FROM 
 *     request_items ri
 * JOIN 
 *     item_requests ir ON ri.request_control_no = ir.control_no
 * WHERE 
 *     ir.status != 'Deleted';
 */
