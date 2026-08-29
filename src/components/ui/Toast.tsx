import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++counter;
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:bottom-4 sm:top-auto">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl bg-white px-4 py-3 shadow-card animate-slide-up ${
                t.kind === "error" ? "ring-1 ring-red-100" : t.kind === "success" ? "ring-1 ring-green-100" : "ring-1 ring-brand-100"
              }`}
            >
              <span className="mt-0.5">
                {t.kind === "success" ? (
                  <CheckCircle2 size={18} className="text-success" />
                ) : t.kind === "error" ? (
                  <AlertCircle size={18} className="text-danger" />
                ) : (
                  <Info size={18} className="text-brand-600" />
                )}
              </span>
              <p className="flex-1 text-sm text-ink">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="text-ink-muted hover:text-ink"
                aria-label="Dismiss"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
