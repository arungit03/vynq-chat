import { NavLink } from "react-router-dom";
import { Home, Search, CircleDot, User, UserRoundPlus, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useIncomingRequests } from "@/hooks/useIncomingRequests";
import { useEffect } from "react";

const items = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/requests", label: "Requests", icon: UserRoundPlus },
  { to: "/status", label: "Status", icon: CircleDot },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Desktop sidebar (hidden on mobile in favor of bottom nav). */
export function Sidebar() {
  const { profile } = useAuth();
  const { unread, refresh } = useNotifications();
  const { count: incomingCount } = useIncomingRequests();
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-brand-100 bg-white md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
              fill="currentColor"
            />
          </svg>
        </div>
        <span className="text-lg font-bold text-ink">Vynq</span>
      </div>

      <nav aria-label="Primary" className="flex-1 px-3">
        <ul className="space-y-1">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:bg-brand-50/60"
                  }`
                }
              >
                <Icon size={20} />
                <span>{label}</span>
                {to === "/requests" && incomingCount > 0 && (
                  <span className="ml-auto min-w-5 rounded-full bg-brand-600 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white">
                    {incomingCount}
                  </span>
                )}
                {to === "/profile" && profile && (
                  <span className="ml-auto">
                    <Avatar src={profile.photoURL} name={profile.displayName} size={24} />
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-brand-100 p-3">
        <div className="flex items-center gap-2 rounded-xl px-2 py-2">
          {profile && <Avatar src={profile.photoURL} name={profile.displayName} size={36} online={profile.isOnline} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{profile?.displayName}</p>
            <p className="truncate text-xs text-ink-muted">@{profile?.username}</p>
          </div>
          {unread > 0 && (
            <span className="ml-auto rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
              {unread}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
