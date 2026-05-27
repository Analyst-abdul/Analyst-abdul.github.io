const { createClient } = window.supabase;
const sb = createClient(
  window.FINTRACK_CONFIG.SUPABASE_URL,
  window.FINTRACK_CONFIG.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } }
);
window.sb = sb;
