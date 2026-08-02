import Link from "next/link";

type IconName = "home" | "books" | "import" | "study" | "calendar" | "review" | "arrow" | "clock" | "check" | "weak";

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
  };

  return <svg aria-hidden="true" className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navItems = [
  { href: "/", label: "Dashboard", mobileLabel: "Home", icon: "home" as const },
  { href: "/workbooks", label: "Workbooks", mobileLabel: "Books", icon: "books" as const },
  { href: "/import", label: "Import", mobileLabel: "Import", icon: "import" as const },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Link href="/" className="brand" aria-label="DtdFLow dashboard">
          <span className="brand-mark"><Icon name="books" size={22} /></span>
          <span><strong>DtdFLow</strong><small>Personal Mentor</small></span>
        </Link>
        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => <Link key={item.href} href={item.href} className={item.href === "/" ? "nav-link active" : "nav-link"}><Icon name={item.icon} /><span>{item.label}</span></Link>)}
        </nav>
        <Link href="/workbooks" className="sidebar-action">Browse Workbooks <Icon name="arrow" size={18} /></Link>
      </aside>

      <header className="mobile-header">
        <Link href="/" className="mobile-brand">DtdFLow</Link>
        <span className="mobile-header-label">Today</span>
      </header>

      <div className="app-content">{children}</div>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navItems.map((item) => <Link key={item.href} href={item.href} className={item.href === "/" ? "mobile-nav-link active" : "mobile-nav-link"}><Icon name={item.icon} size={22} /><span>{item.mobileLabel}</span></Link>)}
      </nav>
    </div>
  );
}
