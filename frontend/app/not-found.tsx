import Link from "next/link";

import { AppShell, Icon } from "@/components/layout/app-shell";

export default function NotFound() {
  return (
    <AppShell>
      <main className="not-found-page">
        <div className="not-found-content">
          <div className="not-found-illustration" aria-hidden="true">
            <span className="not-found-word-tag">Word: 404</span>
            <span className="not-found-lost-tag">Lost?</span>
            <div className="not-found-orbit" />
            <div className="not-found-card">
              <div className="not-found-card-topline">
                <Icon name="books" size={48} />
                <span className="not-found-progress"><span /></span>
              </div>
              <strong>Definition not found...</strong>
              <p>A destination that exists in thought but not in the current URL map.</p>
            </div>
          </div>

          <h1>Page not found</h1>
          <p className="not-found-description">
            The requested page may have been removed or the URL may be incorrect.
            Let&apos;s get you back on track with your learning.
          </p>

          <div className="not-found-actions">
            <Link href="/" className="not-found-link primary">
              <Icon name="home" size={20} />
              Go to Dashboard
            </Link>
            <Link href="/workbooks" className="not-found-link secondary">
              <Icon name="books" size={20} />
              View Workbooks
            </Link>
          </div>
        </div>
      </main>
    </AppShell>
  );
}
