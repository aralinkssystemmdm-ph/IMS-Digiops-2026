import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const lines = fs.readFileSync('.env.example', 'utf8').split('\n');
console.log(lines);
