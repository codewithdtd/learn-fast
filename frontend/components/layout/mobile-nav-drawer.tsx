"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";

import styles from "./mobile-nav-drawer.module.css";

export type MobileNavIconName = "home" | "calendar" | "books" | "import" | "writing";

export type MobileNavEntry = {
  href: string;
  label: string;
  mobileLabel: string;
  primary: boolean;
  icon: MobileNavIconName;
  children?: Array<{ href: string; label: string }>;
};

export function MobileNavDrawer({ items, activeHref }: { items: MobileNavEntry[]; activeHref: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.toggle}
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-drawer"
        onClick={() => setIsOpen(true)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {isOpen && typeof document !== "undefined" && createPortal(
        <div className={styles.layer}>
          <button className={styles.backdrop} type="button" onClick={closeMenu} aria-label="Close navigation menu" />
          <aside ref={drawerRef} id="mobile-navigation-drawer" className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="mobile-navigation-title">
            <div className={styles.drawerHeader}>
              <div><p className={styles.kicker}>LEARN FAST</p><h2 id="mobile-navigation-title">Explore</h2></div>
              <button className={styles.close} type="button" onClick={closeMenu} aria-label="Close navigation menu">×</button>
            </div>
            <nav aria-label="All app sections" className={styles.nav}>
              {items.map((item) => <div className={styles.group} key={item.href}>
                <Link
                  href={item.href}
                  className={styles.link}
                  data-active={item.href === activeHref}
                  aria-current={item.href === activeHref ? "page" : undefined}
                  onClick={closeMenu}
                >
                  <span className={styles.icon} aria-hidden="true"><MobileIcon name={item.icon} /></span>
                  <span>{item.label}</span>
                </Link>
                {item.children && <div className={styles.subnav} aria-label={`${item.label} tools`}>
                  {item.children.map((child) => <Link key={child.href} href={child.href} className={styles.subLink} onClick={closeMenu}>{child.label}</Link>)}
                </div>}
              </div>)}
            </nav>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}

function MobileIcon({ name }: { name: MobileNavIconName }) {
  const paths: Record<MobileNavIconName, ReactNode> = {
    home: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    books: <><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v15H7.5A2.5 2.5 0 0 0 5 20.5z" /><path d="M5 5.5v15M5 20.5A2.5 2.5 0 0 1 7.5 18H20" /></>,
    import: <><path d="M5 3h10l4 4v14H5z" /><path d="M15 3v5h4M12 17V10M9 13l3-3 3 3" /></>,
    writing: <><path d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4M4 20h16" /></>,
  };
  return <svg className={styles.navIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
