export type ClientFaultKind = "route_error" | "root_error" | "window_error" | "unhandled_rejection";

/** Keep client fault reporting data-free until an external monitor is explicitly configured. */
export function reportClientFault(kind: ClientFaultKind) {
  // Error text, stack traces, usernames, and message content never leave the browser.
  void kind;
}
