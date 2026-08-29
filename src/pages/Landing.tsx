import { Link } from "react-router-dom";
import { ShieldCheck, Trash2, MessageCircle, Camera, Smartphone, Lock } from "lucide-react";

const features = [
  { icon: ShieldCheck, title: "Privacy-focused", desc: "Built around your privacy, not engagement metrics." },
  { icon: Trash2, title: "Automatic deletion", desc: "Messages vanish after 7 days. Status after 24 hours." },
  { icon: MessageCircle, title: "Real-time messaging", desc: "Instant, reliable 1:1 conversations." },
  { icon: Camera, title: "Temporary status", desc: "Share moments that disappear in 24 hours." },
  { icon: Smartphone, title: "Installable PWA", desc: "Add Vynq to your home screen. Works offline." },
  { icon: Lock, title: "No permanent baggage", desc: "Media auto-deletes with its message. Less clutter." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-brand-50">
      {/* Nav */}
      <header className="safe-x mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
            </svg>
          </span>
          <span className="text-lg font-bold text-ink">Vynq</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-ghost text-sm">
            Login
          </Link>
          <Link to="/register" className="btn-primary text-sm">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="safe-x mx-auto flex max-w-6xl flex-col items-center px-4 pb-12 pt-8 text-center md:pt-16">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
          <Lock size={13} /> Privacy-first messaging
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight text-ink md:text-6xl">
          Private conversations. <span className="text-brand-600">Less digital baggage.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-soft md:text-lg">
          Vynq-chat is a clean, modern messenger where your messages and status expire automatically. No clutter, no permanence — just connection.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="btn-primary px-6 py-3.5 text-base">
            Get Started
          </Link>
          <Link to="/login" className="btn-outline px-6 py-3.5 text-base">
            Login
          </Link>
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Privacy-focused messaging with automatic data expiration. Not end-to-end encrypted.
        </p>
      </section>

      {/* Features */}
      <section className="safe-x mx-auto max-w-6xl px-4 pb-20">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon size={22} />
              </div>
              <h3 className="font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm text-ink-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="safe-x border-t border-brand-100 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-ink-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Vynq-chat. Connect. Chat. Disappear.</p>
          <p>Messages auto-delete after 7 days · Status after 24 hours.</p>
        </div>
      </footer>
    </div>
  );
}
