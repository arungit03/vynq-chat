import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientErrorObserver from "@/components/client-error-observer";
import NetworkStatus from "@/components/network-status";
import PwaRegister from "@/components/pwa-register";
import { AuthProvider } from "@/lib/auth/auth-provider";

export const metadata: Metadata = {
  title: "Vynq-chat — private conversations, by design",
  description: "A light-blue, privacy-first social chat experience.",
  applicationName: "Vynq-chat",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/vynq-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/vynq-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/vynq-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5c8df6",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <ClientErrorObserver />
        <NetworkStatus />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
