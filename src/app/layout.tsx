import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ConfirmProvider } from "@/components/ConfirmModal";
import PeriAssistantButton from "./PeriAssistantButton";
import "./globals.css";


export const metadata: Metadata = {
  title: "DentSoft",
  description: "Ozanoglu Poliklinik Yonetim Sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <ConfirmProvider>{children}</ConfirmProvider>
        <PeriAssistantButton />
        <Toaster richColors position="top-right" toastOptions={{ duration: 3000 }} />
      </body>
    </html>
  );
}
