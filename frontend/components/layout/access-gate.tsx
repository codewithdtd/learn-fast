"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { AuthModal } from "@/components/auth/auth-modal";
import { PublicDemo } from "@/components/demo/public-demo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import styles from "@/components/demo/public-demo.module.css";

export function AccessGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const [signIn, setSignIn] = useState(false);
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return children;
  // Chỉ mount các component gọi API riêng tư sau khi server đã xác minh role của tài khoản.
  if (isLoading && !signIn) return <main className={styles.page}><p role="status">Checking administrator access…</p></main>;
  if (!isLoading && user?.is_superuser) return <Fragment key={user.id}>{children}</Fragment>;
  if (pathname === "/" || pathname === "/workbooks") return <PublicDemo key={pathname} />;
  return <main className={styles.page}><section className={styles.card}><p className={styles.eyebrow}>ADMINISTRATOR ACCESS REQUIRED</p>
    <h1>This feature is available to administrators</h1><p>Explore the public sample sheet to try flashcards, vocabulary and practice exercises. Full library access, saved progress and AI require an administrator account.</p>
    <div className={styles.actions}><Link href="/demo" className={styles.primary}>Open sample sheet</Link>{!user && <button className={styles.secondary} onClick={() => setSignIn(true)}>Admin sign in</button>}</div>
    {user && <p className={styles.notice}>Your current account does not have administrator permission.</p>}</section>
    <AuthModal isOpen={signIn} onClose={() => setSignIn(false)} initialMode="login" /></main>;
}

export function AdminNotifications() {
  const { user, isLoading } = useAuth();
  return !isLoading && user?.is_superuser ? <NotificationBell key={user.id} /> : null;
}
