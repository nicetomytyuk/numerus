import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabaseRestUrl = supabaseUrl ? `${supabaseUrl}/rest/v1` : undefined;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or anon key missing. Online features will be disabled.');
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  })
  : null;
