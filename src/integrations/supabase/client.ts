/**
 * Supabase Client Configuration
 * 
 * This file initializes the Supabase client for API calls.
 * Environment variables are loaded from .env file.
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://bvmwnxargzlfheiwyget.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bXdueGFyZ3psZmhlaXd5Z2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjY1MjgsImV4cCI6MjA4MzYwMjUyOH0.wicc8Do5vcnwxW57kNHYWJd6qF5rJbjLRHODTtT2ybI";

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
