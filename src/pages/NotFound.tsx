import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-50 p-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-100 text-brand-600">
        <span className="text-2xl font-bold">404</span>
      </div>
      <h1 className="text-xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 max-w-xs text-sm text-ink-soft">
        The page you're looking for doesn't exist or may have expired.
      </p>
      <Link to="/home" className="btn-primary mt-5">
        Back to home
      </Link>
    </div>
  );
}
