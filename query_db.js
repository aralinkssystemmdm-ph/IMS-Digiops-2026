import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://syqdbndqbmuyznsmgjzz.supabase.co', 'sb_publishable_QdLcP4n8-0jMUuepVPKq6g_mn-CE8vo');

async function run() {
  const { data: viewData, error: viewError } = await supabase.from('view_inventory_summary').select('*').limit(1);
  console.log("view_inventory_summary sample:", viewData);
  const { data: txData, error: txError } = await supabase.from('stock_transactions').select('*').limit(1);
  console.log("stock_transactions sample:", txData);
  const { data: eqData, error: eqError } = await supabase.from('equipment').select('*').limit(1);
  console.log("equipment sample:", eqData);
}
run();
