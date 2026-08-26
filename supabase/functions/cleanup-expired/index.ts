import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const cleanupSecret = Deno.env.get("CLEANUP_CRON_SECRET") ?? "";
const storageBucket = "private-media";

function authorized(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const suppliedSecret = request.headers.get("x-cleanup-secret");
  return Boolean(serviceRoleKey && bearer === serviceRoleKey) || Boolean(cleanupSecret && suppliedSecret === cleanupSecret);
}

Deno.serve(async (request) => {
  if (request.method !== "POST" || !authorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();
  const [{ data: expiredMessages }, { data: expiredStatuses }] = await Promise.all([
    admin.from("messages").select("id, storage_path").lte("expires_at", now),
    admin.from("statuses").select("id, storage_path").lte("expires_at", now),
  ]);
  const paths = [...(expiredMessages ?? []), ...(expiredStatuses ?? [])]
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === "string" && path.length > 0);

  if (paths.length) await admin.storage.from(storageBucket).remove(paths);
  const [{ error: messageError }, { error: statusError }] = await Promise.all([
    admin.from("messages").delete().lte("expires_at", now),
    admin.from("statuses").delete().lte("expires_at", now),
  ]);
  if (messageError || statusError) {
    return Response.json({ error: messageError?.message ?? statusError?.message ?? "Cleanup failed" }, { status: 500 });
  }
  return Response.json({ deletedMessages: expiredMessages?.length ?? 0, deletedStatuses: expiredStatuses?.length ?? 0 });
});
