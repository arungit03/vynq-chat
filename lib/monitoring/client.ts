"use client";

import { logEvent } from "firebase/analytics";
import { analyticsPromise } from "@/lib/firebase/client";

export type ClientFaultKind = "route_error" | "root_error" | "window_error" | "unhandled_rejection";

/**
 * Sends only an error category to Analytics. Error messages, stack traces,
 * conversation content, usernames, and route parameters are never collected.
 */
export function reportClientFault(kind: ClientFaultKind) {
  void analyticsPromise
    .then((analytics) => {
      if (analytics) logEvent(analytics, "client_error", { kind });
    })
    .catch(() => undefined);
}
