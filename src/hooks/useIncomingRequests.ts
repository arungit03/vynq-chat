import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { requireFirebase } from "@/lib/firebase/app";
import { useAuth } from "@/context/AuthContext";
import type { FriendRequest } from "@/lib/firebase/types";

/** Keeps the current user's incoming friend requests live for navigation badges and inboxes. */
export function useIncomingRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { db } = requireFirebase();
    const requestsQuery = query(
      collection(db, "friendRequests"),
      where("receiverId", "==", profile.uid),
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        setRequests(
          snapshot.docs
            .map((item) => item.data() as FriendRequest)
            .filter((request) => request.status === "pending")
            .sort((a, b) => b.createdAt - a.createdAt),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );

    return unsubscribe;
  }, [profile]);

  return { requests, count: requests.length, loading };
}
