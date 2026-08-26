import { createClient } from "@supabase/supabase-js";
import { privateMediaBucket, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

export { privateMediaBucket };
