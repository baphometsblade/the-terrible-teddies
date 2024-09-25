import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dutkgzurneffawxesgsj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1dGtnenVybmVmZmF3eGVzZ3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI0MzYyNDMsImV4cCI6MjAzODAxMjI0M30.12IvKY9pzlYbH-TUlvyvyijyuoEZWpUkLwhc17RJYLE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
