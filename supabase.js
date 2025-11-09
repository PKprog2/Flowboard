import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ukiwgiioafkilhcpaymb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVraXdnaWlvYWZraWxoY3BheW1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2OTU4NjIsImV4cCI6MjA3ODI3MTg2Mn0.MLk2IHdXYpC7lKv61KsFpwy4AL7YRzrfIhd5VfWTYO4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
