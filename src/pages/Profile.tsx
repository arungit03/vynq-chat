import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Pencil, Settings as SettingsIcon, Check, LogOut, Camera } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProfileSkeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { updateProfile as updateProfileService } from "@/services/profile";
import { uploadProfilePicture } from "@/services/media";
import { logout } from "@/services/auth";
import { formatSafeTimestamp } from "@/lib/time";
import { validateDisplayName, validateBio } from "@/lib/validation";
import { friendlyError } from "@/lib/errorMap";
import { LIMITS } from "@/lib/constants";

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setBio(profile.bio);
    setFriendsCount(profile.friendsCount);
  }, [profile]);

  if (!profile) return <AppShell><MobileHeader /><ProfileSkeleton /></AppShell>;

  async function handleSave() {
    const dn = validateDisplayName(displayName);
    if (!dn.ok) return toast(dn.error!, "error");
    const b = validateBio(bio);
    if (!b.ok) return toast(b.error!, "error");
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { displayName: displayName.trim(), bio: bio.trim() };
      if (photo) {
        setUploading(true);
        const { url } = await uploadProfilePicture(profile!.uid, photo);
        patch.photoURL = url;
        setUploading(false);
      }
      await updateProfileService(profile!.uid, patch);
      await refreshProfile();
      toast("Profile updated", "success");
      setEditing(false);
      setPhoto(null);
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <AppShell>
      <MobileHeader title="Profile" />
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
          <div className="relative">
            <Avatar src={photo ? URL.createObjectURL(photo) : profile.photoURL} name={profile.displayName} size={96} online={profile.isOnline} />
            {editing && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 rounded-full bg-brand-600 p-2 text-white shadow-soft"
                aria-label="Change photo"
              >
                <Camera size={16} />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          </div>
          {!editing && (
            <>
              <h1 className="mt-3 text-xl font-bold text-ink">{profile.displayName}</h1>
              <p className="text-sm text-ink-muted">@{profile.username}</p>
              {profile.bio && <p className="mt-2 max-w-sm text-sm text-ink-soft">{profile.bio}</p>}
              <div className="mt-4 flex gap-6">
                <Stat label="Friends" value={friendsCount} />
                <Stat label="Joined" value={formatSafeTimestamp(profile.createdAt)} />
              </div>
            </>
          )}
        </div>

        {!editing ? (
          <div className="space-y-2 px-4">
            <button onClick={() => setEditing(true)} className="btn-outline w-full">
              <Pencil size={16} /> Edit profile
            </button>
            <Link to="/settings" className="btn-ghost w-full justify-start">
              <SettingsIcon size={18} /> Settings
            </Link>
            <Link to="/privacy" className="btn-ghost w-full justify-start">
              Privacy controls
            </Link>
            <Button variant="ghost" fullWidth onClick={handleLogout} className="text-danger">
              <LogOut size={18} /> Logout
            </Button>
          </div>
        ) : (
          <div className="space-y-4 px-4">
            <Input label="Display name" value={displayName} maxLength={LIMITS.DISPLAY_NAME_MAX} onChange={(e) => setDisplayName(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink-soft">Bio</label>
              <textarea
                value={bio}
                maxLength={LIMITS.BIO_MAX}
                rows={3}
                onChange={(e) => setBio(e.target.value)}
                className="input-base resize-none"
                placeholder="Tell people a little about you…"
              />
              <p className="mt-1 text-right text-xs text-ink-muted">{bio.length}/{LIMITS.BIO_MAX}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" fullWidth onClick={() => { setEditing(false); setPhoto(null); }} disabled={saving}>
                Cancel
              </Button>
              <Button fullWidth onClick={handleSave} loading={saving || uploading}>
                <Check size={16} /> Save
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 px-4 pb-6">
          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs text-brand-700">
            <strong>Privacy:</strong> Messages auto-delete after 7 days, status after 24 hours. Vynq is privacy-focused
            messaging with automatic data expiration — not end-to-end encrypted.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  );
}
