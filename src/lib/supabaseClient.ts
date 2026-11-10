import { createClient } from '@supabase/supabase-js';

// The same Supabase project as vault26.co.in. Both values come from .env
// (see .env.example) or the hosting provider's environment settings; the
// publishable key is safe in the browser because every table is protected
// by row level security.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

if (!isSupabaseConfigured) {
  console.error('[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set (see .env.example).');
}

// A placeholder URL keeps createClient from throwing at import time; main.tsx
// shows a "not configured" screen instead of the app when the values are missing.
export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'missing-key');
