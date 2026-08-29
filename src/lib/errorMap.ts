// Maps raw Firebase/network errors to friendly, non-technical user messages.
// Never exposes internal codes or raw error strings to the UI.

export function friendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return "Something went wrong. Please try again.";
  const code = e.code ?? "";

  switch (code) {
    // Auth
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/quota-exceeded":
      return "Email sending is temporarily limited. Please try again later.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact support.";
    case "auth/network-request-failed":
      return "Connection lost. Please check your internet connection.";
    case "auth/requires-recent-login":
      return "Please sign in again to continue.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled.";
    case "auth/invalid-continue-uri":
    case "auth/unauthorized-continue-uri":
      return "The verification link settings are invalid. Contact the app administrator.";
    case "auth/user-token-expired":
    case "auth/invalid-user-token":
      return "Your session expired. Please sign in again.";
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
      return "That link is invalid or expired. Request a new one.";
    default:
      break;
  }

  const message = (e.message ?? "").toLowerCase();
  if (message.includes("network") || message.includes("failed to fetch")) {
    return "Connection lost. Please check your internet connection.";
  }
  if (message.includes("permission-denied") || message.includes("permission")) {
    return "You don't have permission to perform this action.";
  }
  if (message.includes("unavailable")) {
    return "Service temporarily unavailable. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
