import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';

const supabaseUrl: string = 'https://ejiwzdtksmgxmesenmli.supabase.co';
const supabaseAnonKey: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqaXd6ZHRrc21neG1lc2VubWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MTU5ODQsImV4cCI6MjA3MzA5MTk4NH0.UzWfkNbDkbDzkd8rhpngT6_PcGgPHemSZ0zZdKXvBu8';

// NOTE: The 'Database' generic type is used for full TypeScript support
// with your database schema. It's recommended to generate these types
// from your Supabase schema for production projects.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);