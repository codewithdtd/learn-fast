import type { Metadata, Viewport } from "next";
import { Inter, Lora, Playfair_Display } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";
import "@/styles/themes/journey.css";

// Cấu hình Viewport chuẩn Mobile-First & iOS PWA Standalone
// viewportFit: "cover" kích hoạt biến môi trường env(safe-area-inset-*) trên iOS (iPhone 15 Pro Max Dynamic Island)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
};

export const metadata: Metadata = {
  title: "English SRS & Mastery Learning",
  description: "Personal English learning application",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.png",
  },
  // Hỗ trợ chế độ WebClip "Thêm vào màn hình chính" (Add to Home Screen) trên iPhone / iOS
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DtdFLow",
  },
  formatDetection: {
    telephone: false,
  },
};

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

const retroBody = Lora({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-retro-body",
});

const retroDisplay = Playfair_Display({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-retro-display",
});

const themeScript = THEME_INIT_SCRIPT;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${retroBody.variable} ${retroDisplay.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}



