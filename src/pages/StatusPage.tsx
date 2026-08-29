import { useEffect, useState } from "react";
import { Plus, Camera } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { FullScreenLoader } from "@/components/ui/Loader";
import { StatusComposer } from "@/components/StatusComposer";
import { StatusViewer } from "@/components/StatusViewer";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { getMyStatuses, getFriendStatuses, type Status } from "@/services/status";
import { getFriends } from "@/services/friends";
import type { UserProfile } from "@/lib/firebase/types";

interface FriendBucket {
  user: UserProfile;
  statuses: Status[];
}

export default function StatusPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [myStatuses, setMyStatuses] = useState<Status[]>([]);
  const [buckets, setBuckets] = useState<FriendBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewer, setViewer] = useState<{ statuses: Status[]; index: number } | null>(null);

  async function load() {
    if (!profile) return;
    setLoading(true);
    try {
      const [mine, friends] = await Promise.all([getMyStatuses(profile.uid), getFriends(profile.uid, 100)]);
      setMyStatuses(mine);
      const friendIds = friends.map((f) => f.uid);
      const all = await getFriendStatuses(friendIds);
      // group by owner
      const map = new Map<string, Status[]>();
      all.forEach((s) => {
        if (!map.has(s.ownerId)) map.set(s.ownerId, []);
        map.get(s.ownerId)!.push(s);
      });
      const bs: FriendBucket[] = friends
        .filter((f) => map.has(f.uid))
        .map((f) => ({ user: f, statuses: map.get(f.uid)! }));
      setBuckets(bs);
    } catch (e) {
      toast("Failed to load statuses", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (loading) return <AppShell><MobileHeader title="Status" /><FullScreenLoader label="Loading status…" /></AppShell>;

  return (
    <AppShell>
      <MobileHeader title="Status" />
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-4 pt-4">
          <h1 className="text-2xl font-bold text-ink">Status</h1>
          <Button size="sm" onClick={() => setComposerOpen(true)}>
            <Plus size={16} /> Add
          </Button>
        </div>

        {/* My status */}
        <section className="px-4 pt-3">
          <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">My status</h2>
          <button
            onClick={() => (myStatuses.length ? setViewer({ statuses: myStatuses, index: 0 }) : setComposerOpen(true))}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-soft"
          >
            <div className="relative">
              <Avatar src={profile?.photoURL} name={profile?.displayName ?? "Me"} size={56} />
              {myStatuses.length === 0 && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-brand-600 p-1.5 text-white">
                  <Plus size={14} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{myStatuses.length ? "My status" : "Add status"}</p>
              <p className="truncate text-sm text-ink-muted">
                {myStatuses.length ? `${myStatuses.length} update${myStatuses.length > 1 ? "s" : ""} · visible to friends` : "Share something that disappears in 24 hours"}
              </p>
            </div>
          </button>
        </section>

        {/* Recent updates */}
        <section className="px-4 py-4">
          <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">Recent updates</h2>
          {buckets.length === 0 ? (
            <EmptyState
              icon={<Camera size={26} />}
              title="No status updates yet"
              description="When friends post status, it'll appear here. Status vanishes after 24 hours."
            />
          ) : (
            <ul className="space-y-1">
              {buckets.map((b) => (
                <li key={b.user.uid}>
                  <button
                    onClick={() => setViewer({ statuses: b.statuses, index: 0 })}
                    className="flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-white"
                  >
                    <div className="rounded-full p-0.5 ring-2 ring-brand-400">
                      <Avatar src={b.user.photoURL} name={b.user.displayName} size={52} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{b.user.displayName}</p>
                      <p className="truncate text-sm text-ink-muted">
                        {b.statuses.length} update{b.statuses.length > 1 ? "s" : ""} · Tap to view
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="px-4 pb-6">
          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs text-brand-700">
            Status is visible only to your friends and auto-deletes after 24 hours. Videos are capped at 30 seconds.
          </div>
        </div>
      </div>

      <StatusComposer open={composerOpen} onClose={() => setComposerOpen(false)} onPosted={load} />
      {viewer && (
        <StatusViewer
          statuses={viewer.statuses}
          startIndex={viewer.index}
          myId={profile!.uid}
          onClose={() => setViewer(null)}
          onNavigate={() => {}}
        />
      )}
    </AppShell>
  );
}
