import { useCallback, useEffect, useState } from "react";
import { onSnapshot, query, orderBy, collection } from "firebase/firestore";
import { requireFirebase } from "@/lib/firebase/app";
import { useAuth } from "@/context/AuthContext";
import type { AppNotification } from "@/lib/firebase/types";

export function useNotifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!profile) return;
    const { db } = requireFirebase();
    const q = query(collection(db, "users", profile.uid, "notifications"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.slice(0, 50).map((d) => d.data() as AppNotification);
      setNotifications(list);
      setUnread(list.filter((n) => !n.read).length);
      setLoading(false);
    });
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const unsub = refresh();
    return () => unsub?.();
  }, [refresh]);

  return { notifications, unread, loading, refresh };
}
