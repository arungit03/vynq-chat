// Time + formatting helpers. No Date.now() reliance for display correctness
// (Firestore server timestamps feed these). Uses Intl for locale-aware output.

export function formatChatTime(ts: number | undefined | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (isYesterday) return "Yesterday";
  const withinWeek = now.getTime() - ts < 7 * 24 * 60 * 60 * 1000;
  if (withinWeek) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatLastSeen(ts: number | undefined | null, isOnline: boolean): string {
  if (isOnline) return "Online";
  if (!ts) return "Offline";
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "last seen just now";
  if (min < 60) return `last seen ${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `last seen ${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `last seen ${day}d ago`;
  return `last seen ${new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function formatStatusTime(ts: number | undefined | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatSafeTimestamp(ts: number | undefined | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
