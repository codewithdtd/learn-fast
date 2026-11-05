import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  Upload,
  GraduationCap,
  Calendar,
  RotateCcw,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Flame,
  Bookmark,
  Eye,
  EyeOff,
  ChevronDown,
  ArrowLeft,
  Play,
  Bell,
  PenTool,
  Trash2,
  LucideIcon,
} from "lucide-react";
import { UserProfileMenu } from "@/components/auth/user-profile-menu";
import { DemoBadge } from "@/components/layout/demo-badge";
import { AccessGate, AdminNotifications } from "@/components/layout/access-gate";
import { MobileNavDrawer, type MobileNavEntry } from "@/components/layout/mobile-nav-drawer";
import { ThemeToggle } from "./theme-toggle";

export type IconName =
  | "home"
  | "books"
  | "import"
  | "study"
  | "calendar"
  | "review"
  | "arrow"
  | "clock"
  | "check"
  | "weak"
  | "refresh"
  | "search"
  | "flame"
  | "bookmark"
  | "eye"
  | "eyeOff"
  | "chevronDown"
  | "back"
  | "play"
  | "bell"
  | "writing"
  | "trash";

/**
 * Clean, cohesive Lucide vector icon mapping
 * Completely eliminates old cartoon 3D PNGs and unoptimized raw SVGs.
 */
const ICON_MAP: Record<IconName, LucideIcon> = {
  home: LayoutDashboard,
  books: BookOpen,
  import: Upload,
  study: GraduationCap,
  calendar: Calendar,
  review: RotateCcw,
  arrow: ArrowRight,
  clock: Clock,
  check: CheckCircle2,
  weak: AlertTriangle,
  refresh: RefreshCw,
  search: Search,
  flame: Flame,
  bookmark: Bookmark,
  eye: Eye,
  eyeOff: EyeOff,
  chevronDown: ChevronDown,
  back: ArrowLeft,
  play: Play,
  bell: Bell,
  writing: PenTool,
  trash: Trash2,
};

export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Component = ICON_MAP[name] || BookOpen;
  return <Component size={size} className={`icon shrink-0 ${className}`.trim()} aria-hidden="true" />;
}

const navItems: MobileNavEntry[] = [
  { href: "/", label: "Dashboard", mobileLabel: "Home", icon: "home", primary: true },
  { href: "/calendar", label: "Calendar", mobileLabel: "Calendar", icon: "calendar", primary: true },
  { href: "/workbooks", label: "Workbooks", mobileLabel: "Books", icon: "books", primary: true },
  { href: "/import", label: "Import workbook", mobileLabel: "Import", icon: "import", primary: false },
  {
    href: "/ai-support",
    label: "AI Support",
    mobileLabel: "AI Tools",
    icon: "writing",
    primary: true,
    children: [
      { href: "/ai-support?tab=sentences", label: "Sentence practice" },
      { href: "/ai-support?tab=writing", label: "Writing practice" },
      { href: "/ai-support?tab=speaking", label: "Speaking practice" },
      { href: "/ai-support?tab=video", label: "Video practice" },
    ],
  },
  { href: "/reading", label: "Read the news", mobileLabel: "Reading", icon: "books", primary: true },
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
      {/* Desktop Sidebar: 240px wide, high contrast, clean typography */}
      <aside className="desktop-sidebar">
        <Link href="/" className="brand" aria-label="DtdFLow dashboard">
          <span className="brand-mark">
            <Icon name="books" size={20} />
          </span>
          <div>
            <strong>DtdFLow</strong>
            <small>Personal Mentor</small>
          </div>
        </Link>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.href === activeHref ? "nav-link active" : "nav-link"}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle />
          <Link href="/workbooks" className="sidebar-action">
            <span>Browse Workbooks</span>
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      </aside>

      {/* Mobile Top Header: 52px height, sticky with backdrop blur */}
      <header className="mobile-header">
        <Link href="/" className="mobile-brand" aria-label="DtdFLow Home">
          <span className="brand-mark mobile-brand-mark">
            <Icon name="books" size={16} />
          </span>
          <span>DtdFLow</span>
        </Link>
        <div className="mobile-header-actions flex items-center gap-1.5">
          <DemoBadge />
          <ThemeToggle compact />
          <AdminNotifications />
          <UserProfileMenu />
          <MobileNavDrawer items={navItems} activeHref={activeHref} />
        </div>
      </header>

      {/* Main Workspace Canvas */}
      <div className="app-content">
        <div className="desktop-top-bar flex items-center justify-end gap-3">
          <DemoBadge />
          <AdminNotifications />
          <UserProfileMenu />
        </div>
        <AccessGate>{children}</AccessGate>
      </div>

      {/* Mobile Bottom Navigation: Thumb zone ergonomic layout with 5 primary tabs */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {navItems
          .filter((item) => item.primary)
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={item.href === activeHref ? "page" : undefined}
              className={item.href === activeHref ? "mobile-nav-link active" : "mobile-nav-link"}
            >
              <span className="mobile-nav-icon">
                <Icon name={item.icon} size={20} />
              </span>
              <span className="mobile-nav-label">{item.mobileLabel}</span>
            </Link>
          ))}
      </nav>
    </div>
  );
}
