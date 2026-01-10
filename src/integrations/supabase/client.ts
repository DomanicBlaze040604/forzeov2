/**
 * Supabase Client Configuration
 * 
 * This file initializes the Supabase client for API calls.
 * Environment variables are loaded from .env file.
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bvmwnxargzlfheiwyget.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// Validate configuration
if (!SUPABASE_URL) {
  console.error("Missing VITE_SUPABASE_URL environment variable");
}

if (!SUPABASE_ANON_KEY) {
  console.error("Missing VITE_SUPABASE_PUBLISHABLE_KEY environment variable");
}

// Create and export the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Export URL for reference
export const supabaseUrl = SUPABASE_URL;
