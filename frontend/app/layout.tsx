import type { Metadata } from "next";
import { Inter, Lora, Playfair_Display } from "next/font/google";
import { AuthProvider } from "@/context/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "English SRS & Mastery Learning",
  description: "Personal English learning application",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png"
  }
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

const themeScript = `(() => {
  try {
    const storedTheme = localStorage.getItem("learn-fast-theme");
    const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "retro"
      ? storedTheme
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch {}
})();`;

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



