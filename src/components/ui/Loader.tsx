interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 24, className = "", label }: SpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span
        className="inline-block animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label ?? "Loading"}
      />
      {label && <span className="text-sm text-ink-muted">{label}</span>}
    </span>
  );
}

export function FullScreenLoader({ label = "Loading Vynq-chat…" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[60vh] w-full flex-col items-center justify-center gap-3 text-ink-muted">
      <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
