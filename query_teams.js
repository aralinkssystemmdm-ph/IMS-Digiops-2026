import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://syqdbndqbmuyznsmgjzz.supabase.co', 'sb_publishable_QdLcP4n8-0jMUuepVPKq6g_mn-CE8vo');

async function run() {
  const { data: eqData } = await supabase.from('item_location_stocks').select('item_code, team');
  
  const map = {};
  for(const r of eqData) {
    if (!map[r.item_code]) map[r.item_code] = new Set();
    map[r.item_code].add(r.team);
  }
  
  for(const k in map) {
    if(map[k].size > 1) {
      console.log(`Item ${k} has multiple teams: `, map[k]);
    }
  }
  console.log("Done checking.");
}
run();
