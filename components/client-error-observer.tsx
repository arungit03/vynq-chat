"use client";

import { useEffect } from "react";
import { reportClientFault } from "@/lib/monitoring/client";

/** Records anonymous browser-failure counts without leaking private content. */
export default function ClientErrorObserver() {
  useEffect(() => {
    const reportWindowError = () => reportClientFault("window_error");
    const reportUnhandledRejection = () => reportClientFault("unhandled_rejection");
    window.addEventListener("error", reportWindowError);
    window.addEventListener("unhandledrejection", reportUnhandledRejection);
    return () => {
      window.removeEventListener("error", reportWindowError);
      window.removeEventListener("unhandledrejection", reportUnhandledRejection);
    };
  }, []);

  return null;
}
