import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Shows a non-blocking banner when the browser is offline. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/10 px-4 py-2 text-sm font-medium text-warning-700"
    >
      <WifiOff size={16} />
      You're offline. Messages will send when you reconnect.
    </div>
  );
}
