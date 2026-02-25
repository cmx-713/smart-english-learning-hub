import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase URL and Anon Key
// In a real project, use process.env.REACT_APP_SUPABASE_URL etc.
const supabaseUrl = process.env.SUPABASE_URL || 'https://jorzfzjlnxnhnwxczxmu.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvcnpmempsbnhuaG53eGN6eG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NTk4NzMsImV4cCI6MjA4NjQzNTg3M30.ueL1nGFIau9f6Rmi5VFB6CGvsLdrUmQf20tLL6qmc2I';

export const supabase = createClient(supabaseUrl, supabaseKey);