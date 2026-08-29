import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getRelation, areFriends } from "@/services/friends";
import type { RelationState } from "@/components/UserCard";

/** Batch-resolves relation state between the current user and a list of users. */
export function useRelations(uids: string[]) {
  const { profile } = useAuth();
  const [relations, setRelations] = useState<Record<string, RelationState>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profile || uids.length === 0) {
      setRelations({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const map: Record<string, RelationState> = {};
      await Promise.all(
        uids.map(async (uid) => {
          if (uid === profile.uid) {
            map[uid] = "none";
            return;
          }
          const { request } = await getRelation(profile.uid, uid);
          if (!request) {
            map[uid] = "none";
          } else if (request.status === "accepted") {
            map[uid] = "friends";
          } else if (request.status === "blocked") {
            map[uid] = "blocked";
          } else if (request.senderId === profile.uid) {
            map[uid] = "pending_out";
          } else {
            map[uid] = "pending_in";
          }
        }),
      );
      if (!cancelled) {
        setRelations(map);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, uids.join(",")]);

  const setRelation = useCallback((uid: string, state: RelationState) => {
    setRelations((prev) => ({ ...prev, [uid]: state }));
  }, []);

  return { relations, loading, setRelation };
}

export { areFriends };
