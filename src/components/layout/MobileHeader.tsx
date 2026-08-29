import { Link } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { Bell } from "lucide-react";

/** Mobile top header with brand + notifications. Shown within app pages on mobile. */
export function MobileHeader({ title }: { title?: string }) {
  const { unread } = useNotifications();
  return (
    <header className="safe-top sticky top-0 z-30 flex items-center justify-between border-b border-brand-100 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <Link to="/home" className="flex items-center gap-2" aria-label="Vynq-chat home">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          </svg>
        </span>
        <span className="text-base font-bold text-ink">{title ?? "Vynq"}</span>
      </Link>
      <Link
        to="/profile"
        className="relative rounded-full p-2 text-ink-soft hover:bg-brand-50"
        aria-label="Notifications and profile"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-danger" aria-hidden />
        )}
      </Link>
    </header>
  );
}
