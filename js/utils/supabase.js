const SUPABASE_URL  = 'https://cnspbiftiwvfxkdzvpdb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuc3BiaWZ0aXd2ZnhrZHp2cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzk4MzQsImV4cCI6MjA4OTYxNTgzNH0._Ysvx1wD2zi-qxX8cgcGpCnFAG_QuOCDorUhOclw-Ec';
 
// Cliente global — disponible como window.SupabaseClient
window.SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
 
console.log('[Supabase] Cliente inicializado.');
 