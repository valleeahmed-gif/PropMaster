import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cghiodbvbggizghxuvna.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaGlvZGJ2YmdnaXpnaHh1dm5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MzAwNzUsImV4cCI6MjA5NDMwNjA3NX0.22Z7lvVrazcV5MFfP7UBSEGNwlLkowHiItWaXqfU52Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
