"use client";

import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
        // PWA enhancement is optional; the application remains usable without it.
      });
    }
  }, []);

  return null;
}
