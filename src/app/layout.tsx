import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spice Route Kitchen — Restaurant Manager",
  description: "Role-based restaurant management system",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#061812",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-body antialiased min-h-screen text-[#FAF8F5] bg-[#061812] relative overflow-x-hidden selection:bg-emerald-500/40 selection:text-white">
        {/* Ambient luminous botanical glow orbs for authentic deep-green & off-white refraction */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
          <div className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-emerald-500/18 to-teal-800/8 blur-[130px]" />
          <div className="absolute top-[35%] -right-[12%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-amber-100/8 to-emerald-700/10 blur-[140px]" />
          <div className="absolute -bottom-[15%] left-[25%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-br from-teal-500/14 to-emerald-900/12 blur-[130px]" />
        </div>
        <div className="relative z-10 min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
