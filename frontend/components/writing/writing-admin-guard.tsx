"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { AuthModal } from "@/components/auth/auth-modal";
import { AppShell } from "@/components/layout/app-shell";
import styles from "./writing.module.css";

export function WritingAdminGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  if (isLoading) {
    return <AppShell activeHref="/writing"><main className={styles.page}><div className={styles.loadingCard} role="status">Checking access...</div></main></AppShell>;
  }

  // Wait for verified account permissions before mounting children that fetch private Writing data.
  if (user?.is_superuser) return children;

  return (
    <AppShell activeHref="/writing">
      <main className={styles.page}>
        <section className={styles.emptyCard} aria-labelledby="writing-access-title">
          <p className={styles.eyebrow}>ADMIN ACCESS ONLY</p>
          <h1 id="writing-access-title">Writing practice is restricted</h1>
          <p>Only administrators can access writing practice, AI topics, feedback, and writing history.</p>
          {!user && <button className={styles.primaryButton} onClick={() => setAuthOpen(true)}>Sign in as an administrator</button>}
          <Link className={styles.backLink} href="/">Back to dashboard</Link>
        </section>
      </main>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </AppShell>
  );
}
