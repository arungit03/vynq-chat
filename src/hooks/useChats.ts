import { useEffect, useState } from "react";
import { subscribeToMyChats } from "@/services/chat";
import { useAuth } from "@/context/AuthContext";
import type { Chat } from "@/lib/firebase/types";

export function useMyChats() {
  const { profile } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    const unsub = subscribeToMyChats(profile.uid, (list) => {
      setChats(list);
      setLoading(false);
    });
    return () => unsub();
  }, [profile]);

  return { chats, loading };
}
