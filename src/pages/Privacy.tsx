import { useState, useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { updatePrivacy } from "@/services/profile";
import type { PrivacySettings } from "@/lib/firebase/types";

export default function Privacy() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setPrivacy(profile.privacy);
  }, [profile]);

  if (!profile || !privacy) return <AppShell><MobileHeader title="Privacy" /></AppShell>;

  function update<K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) {
    setPrivacy((p) => (p ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!privacy) return;
    setSaving(true);
    try {
      await updatePrivacy(profile!.uid, privacy);
      await refreshProfile();
      toast("Privacy settings saved", "success");
    } catch {
      toast("Couldn't save. Try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <MobileHeader title="Privacy" />
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-4 pt-4">
          <Link to="/profile" className="rounded-full p-2 text-ink-soft hover:bg-brand-50" aria-label="Back">
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-2xl font-bold text-ink">Privacy</h1>
        </div>

        <Section title="Who can reach you">
          <Row label="Allow friend requests" hint="Turn off to stop receiving new requests.">
            <Toggle checked={privacy.whoCanRequest === "everyone"} onChange={(v) => update("whoCanRequest", v ? "everyone" : "no_one")} label="Allow friend requests" />
          </Row>
        </Section>

        <Section title="Presence">
          <Row label="Show online status" hint="Friends see when you're online.">
            <Toggle checked={privacy.showOnline} onChange={(v) => update("showOnline", v)} label="Show online status" />
          </Row>
          <Row label="Show last seen" hint="Friends see when you were last active.">
            <Toggle checked={privacy.showLastSeen} onChange={(v) => update("showLastSeen", v)} label="Show last seen" />
          </Row>
        </Section>

        <Section title="Messaging">
          <Row label="Read receipts" hint="Let others know when you've read their messages.">
            <Toggle checked={privacy.readReceipts} onChange={(v) => update("readReceipts", v)} label="Read receipts" />
          </Row>
        </Section>

        <Section title="Status">
          <Row label="Status visibility" hint="Choose who can view your 24-hour status.">
            <Toggle checked={privacy.statusVisibility === "friends"} onChange={(v) => update("statusVisibility", v ? "friends" : "no_one")} label="Status visible to friends" />
          </Row>
        </Section>

        <Section title="Notifications">
          <Row label="Message notifications">
            <Toggle checked={privacy.notifyMessages} onChange={(v) => update("notifyMessages", v)} label="Message notifications" />
          </Row>
          <Row label="Friend request notifications">
            <Toggle checked={privacy.notifyFriendRequests} onChange={(v) => update("notifyFriendRequests", v)} label="Friend request notifications" />
          </Row>
          <Row label="Status notifications">
            <Toggle checked={privacy.notifyStatus} onChange={(v) => update("notifyStatus", v)} label="Status notifications" />
          </Row>
        </Section>

        <div className="px-4 pb-8 pt-2">
          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs text-brand-700">
            Vynq is privacy-focused messaging with automatic data expiration. Messages auto-delete after 7 days and status
            after 24 hours. This app is not end-to-end encrypted.
          </div>
          <Button fullWidth className="mt-4" loading={saving} onClick={save}>
            Save privacy settings
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-4 pt-4">
      <h2 className="mb-1 px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-brand-50 px-4 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
