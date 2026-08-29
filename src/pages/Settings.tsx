import { useState } from "react";
import { Link } from "react-router-dom";
import { User, Shield, Bell, Palette, KeyRound, LogOut, Trash2, ChevronRight, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { logout, changePassword } from "@/services/auth";
import { deleteAccountCompletely } from "@/services/account";
import { friendlyError } from "@/lib/errorMap";

export default function Settings() {
  const { profile, firebaseUser } = useAuth();
  const { toast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState("");

  if (!profile) return <AppShell><MobileHeader title="Settings" /></AppShell>;

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccountCompletely(profile!.uid);
      toast("Your account has been deleted.", "success");
      window.location.href = "/login";
    } catch (err) {
      toast(friendlyError(err), "error");
      setDeleting(false);
    }
  }

  async function handleChangePassword() {
    setPwErr("");
    setPwBusy(true);
    try {
      await changePassword(firebaseUser!, currentPw, newPw);
      toast("Password changed.", "success");
      setPwModal(false);
      setCurrentPw("");
      setNewPw("");
    } catch (err) {
      setPwErr(friendlyError(err));
    } finally {
      setPwBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <AppShell>
      <MobileHeader title="Settings" />
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto">
        <h1 className="px-4 pt-4 text-2xl font-bold text-ink">Settings</h1>

        <Section title="Account">
          <InfoRow icon={<User size={18} />} label="Email" value={profile.email} />
          <InfoRow icon={<User size={18} />} label="Username" value={`@${profile.username}`} />
          <button onClick={() => setPwModal(true)} className="row-btn">
            <KeyRound size={18} className="text-ink-soft" />
            <span className="flex-1 text-left text-sm text-ink">Change password</span>
            <ChevronRight size={18} className="text-ink-muted" />
          </button>
        </Section>

        <Section title="Preferences">
          <Link to="/privacy" className="row-btn">
            <Shield size={18} className="text-ink-soft" />
            <span className="flex-1 text-left text-sm text-ink">Privacy controls</span>
            <ChevronRight size={18} className="text-ink-muted" />
          </Link>
          <div className="row-btn">
            <Bell size={18} className="text-ink-soft" />
            <span className="flex-1 text-left text-sm text-ink">Notifications</span>
            <ChevronRight size={18} className="text-ink-muted" />
          </div>
          <div className="row-btn">
            <Palette size={18} className="text-ink-soft" />
            <span className="flex-1 text-left text-sm text-ink">Appearance</span>
            <span className="text-xs text-ink-muted">Light</span>
          </div>
        </Section>

        <div className="px-4 pt-4">
          <Button variant="outline" fullWidth onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </Button>
        </div>

        <Section title="Danger zone">
          <button onClick={() => setConfirmDelete(true)} className="row-btn text-danger">
            <Trash2 size={18} />
            <span className="flex-1 text-left text-sm font-medium">Delete account</span>
            <ChevronRight size={18} className="text-ink-muted" />
          </button>
        </Section>

        <div className="px-4 pb-8 pt-2">
          <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs text-brand-700">
            Messages auto-delete after 7 days. Status after 24 hours. This is privacy-focused messaging with automatic data
            expiration — not end-to-end encrypted.
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete your account?"
        message="This permanently removes your profile, friends, conversations, and media. This cannot be undone."
        confirmLabel="Delete account"
        cancelLabel="Cancel"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />

      <Modal open={pwModal} onClose={() => setPwModal(false)} title="Change password">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleChangePassword();
          }}
          className="space-y-3"
        >
          <Input label="Current password" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
          <Input label="New password" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required hint="At least 8 characters." />
          {pwErr && (
            <p className="flex items-center gap-1.5 text-sm text-danger">
              <AlertTriangle size={15} /> {pwErr}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" fullWidth onClick={() => setPwModal(false)} disabled={pwBusy}>
              Cancel
            </Button>
            <Button fullWidth type="submit" loading={pwBusy}>
              Update
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pt-4">
      <h2 className="mb-1 px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-white shadow-soft">{children}</div>
    </section>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-brand-50 px-4 py-3 last:border-0">
      <span className="text-ink-soft">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="truncate text-sm font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}
