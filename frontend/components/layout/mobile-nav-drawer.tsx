"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Icon, type IconName } from "@/components/layout/app-shell";

import styles from "./mobile-nav-drawer.module.css";

export type MobileNavIconName = IconName;

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
        <Menu size={20} aria-hidden="true" />
      </button>
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className={styles.layer}>
            <button className={styles.backdrop} type="button" onClick={closeMenu} aria-label="Close navigation menu" />
            <aside
              ref={drawerRef}
              id="mobile-navigation-drawer"
              className={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-navigation-title"
            >
              <div className={styles.drawerHeader}>
                <div>
                  <p className={styles.kicker}>LEARN FAST</p>
                  <h2 id="mobile-navigation-title">Menu</h2>
                </div>
                <button className={styles.close} type="button" onClick={closeMenu} aria-label="Close navigation menu">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <nav aria-label="All app sections" className={styles.nav}>
                {items.map((item) => (
                  <div className={styles.group} key={item.href}>
                    <Link
                      href={item.href}
                      className={styles.link}
                      data-active={item.href === activeHref}
                      aria-current={item.href === activeHref ? "page" : undefined}
                      onClick={closeMenu}
                    >
                      <span className={styles.icon} aria-hidden="true">
                        <Icon name={item.icon} size={20} />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                    {item.children && (
                      <div className={styles.subnav} aria-label={`${item.label} tools`}>
                        {item.children.map((child) => (
                          <Link key={child.href} href={child.href} className={styles.subLink} onClick={closeMenu}>
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}
