import Link from "next/link";
import { UserProfileMenu } from "@/components/auth/user-profile-menu";
import { DemoBadge } from "@/components/layout/demo-badge";
import { AccessGate, AdminNotifications } from "@/components/layout/access-gate";
import { MobileNavDrawer, type MobileNavEntry } from "@/components/layout/mobile-nav-drawer";
import { ThemeToggle } from "./theme-toggle";



type IconName = "home" | "books" | "import" | "study" | "calendar" | "review" | "arrow" | "clock" | "check" | "weak" | "refresh" | "search" | "flame" | "bookmark" | "eye" | "eyeOff" | "chevronDown" | "back" | "play" | "bell" | "writing" | "trash";

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    books: <><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v15H7.5A2.5 2.5 0 0 0 5 20.5z" /><path d="M5 5.5v15M5 20.5A2.5 2.5 0 0 1 7.5 18H20" /></>,
    import: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v5h4M12 17V10M9 13l3-3 3 3" /></>,
    study: <><path d="m3 9 9-5 9 5-9 5z" /><path d="M6 11v5c3 2 6 3 9 0v-5M21 10v6" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    review: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2M9 2h6" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    check: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    weak: <><path d="m12 20-7-8a4.5 4.5 0 0 1 7-5.5A4.5 4.5 0 0 1 19 12z" /><path d="M12 9v4M12 16h.01" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.7-3L4 10" /><path d="M4 5v5h5M4 13a8 8 0 0 0 14.7 3L20 14" /><path d="M20 19v-5h-5" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    flame: <path d="M12 21c4.2 0 7-2.8 7-6.8 0-3.2-1.7-5.5-4.8-8.2.1 2.2-.8 3.4-2 4.2.2-3.3-1.4-6-4-8.2.1 3.2-2.2 5.5-2.2 8.8C6 18 8.7 21 12 21Z" />,
    bookmark: <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3-6 3z" />,
    eye: <><path d="M2.5 12s3.3-5 9.5-5 9.5 5 9.5 5-3.3 5-9.5 5-9.5-5Z" /><circle cx="12" cy="12" r="2.5" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.2 0 9.5 7 9.5 7a14 14 0 0 1-3 3.7M6.2 6.2C3.8 7.8 2.5 12 2.5 12s3.3 7 9.5 7c1 0 2-.2 2.8-.5" /></>,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    back: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></>,
    writing: <><path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4M4 20h16" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" /></>,
  };

  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navItems: MobileNavEntry[] = [
  { href: "/", label: "Dashboard", mobileLabel: "Home", icon: "home", primary: true },
  { href: "/calendar", label: "Calendar & Check-in", mobileLabel: "Calendar", icon: "calendar", primary: true },
  { href: "/workbooks", label: "Workbooks", mobileLabel: "Books", icon: "books", primary: true },
  { href: "/import", label: "Import workbook", mobileLabel: "Import", icon: "import", primary: false },
  {
    href: "/ai-support",
    label: "AI Support",
    mobileLabel: "AI",
    icon: "writing",
    primary: true,
    children: [
      { href: "/ai-support?tab=sentences", label: "Sentence practice" },
      { href: "/ai-support?tab=writing", label: "Writing practice" },
      { href: "/ai-support?tab=speaking", label: "Speaking practice" },
      { href: "/ai-support?tab=video", label: "Video practice" },
    ],
  },
  { href: "/reading", label: "Read the news", mobileLabel: "Read", icon: "books", primary: true },
];


export function AppShell({
  children,
  activeHref = "/",
}: {
  children: React.ReactNode;
  activeHref?: string;
}) {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Link href="/" className="brand" aria-label="DtdFLow dashboard">
          <span className="brand-mark"><Icon name="books" size={22} /></span>
          <span><strong>DtdFLow</strong><small>Personal Mentor</small></span>
        </Link>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => <Link key={item.href} href={item.href} className={item.href === activeHref ? "nav-link active" : "nav-link"}><Icon name={item.icon} /><span>{item.label}</span></Link>)}
        </nav>
        <ThemeToggle />
        <Link href="/workbooks" className="sidebar-action">Browse Workbooks <Icon name="arrow" size={18} /></Link>
      </aside>

      <header className="mobile-header">
        <Link href="/" className="mobile-brand" aria-label="DtdFLow Home">
          <span className="brand-mark mobile-brand-mark"><Icon name="books" size={18} /></span>
          <span>DtdFLow</span>
        </Link>
        <div className="mobile-header-actions flex items-center">
          <DemoBadge />
          <ThemeToggle compact />
          <AdminNotifications />
          <UserProfileMenu />
          <MobileNavDrawer items={navItems} activeHref={activeHref} />
        </div>
      </header>

      <div className="app-content">
        <div className="desktop-top-bar flex items-center justify-end gap-3">
          <DemoBadge />
          <AdminNotifications />
          <UserProfileMenu />
        </div>
        <AccessGate>{children}</AccessGate>
      </div>


      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navItems.filter((item) => item.primary).map((item) => <Link key={item.href} href={item.href} aria-label={item.label} aria-current={item.href === activeHref ? "page" : undefined} className={item.href === activeHref ? "mobile-nav-link active" : "mobile-nav-link"}><span className="mobile-nav-icon"><Icon name={item.icon} size={22} /></span><span className="mobile-nav-label">{item.mobileLabel}</span></Link>)}
      </nav>
    </div>
  );
}
