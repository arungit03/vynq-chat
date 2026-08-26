function requiredEnv(name: string, value: string | undefined): string {
  if (!value || value.includes("your-project") || value === "replace-me") {
    throw new Error(`Missing Supabase environment variable: ${name}`);
  }
  return value;
}

export const supabaseUrl = requiredEnv("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL);
export const supabasePublishableKey = requiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export const privateMediaBucket = "private-media";
