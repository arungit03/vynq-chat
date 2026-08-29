import { NavLink } from "react-router-dom";
import { Home, Search, CircleDot, User, UserRoundPlus, type LucideIcon } from "lucide-react";
import { useIncomingRequests } from "@/hooks/useIncomingRequests";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/requests", label: "Requests", icon: UserRoundPlus },
  { to: "/status", label: "Status", icon: CircleDot },
  { to: "/profile", label: "Profile", icon: User },
];

/** Mobile bottom navigation. Accessible: aria-labels, active state, focus ring. */
export function BottomNavigation() {
  const { count: incomingCount } = useIncomingRequests();

  return (
    <nav
      aria-label="Primary"
      className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-40 border-t border-brand-100 bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? "text-brand-600" : "text-ink-muted hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                    {to === "/requests" && incomingCount > 0 && (
                      <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
                        {incomingCount}
                      </span>
                    )}
                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-600" />
                    )}
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
