"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/auth-context";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
}

const subscribeToNothing = () => () => undefined;
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  // Mỗi lần mở là form mới, tránh giữ mật khẩu hoặc lỗi cũ sau khi người dùng đóng hộp thoại.
  return isOpen ? <AuthDialog key={initialMode} onClose={onClose} initialMode={initialMode} /> : null;
}

function AuthDialog({ onClose, initialMode }: Pick<AuthModalProps, "onClose" | "initialMode">) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(initialMode ?? "login");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestPending = useRef(false);
  const mounted = useSyncExternalStore(subscribeToNothing, getClientMountedSnapshot, getServerMountedSnapshot);

  useEffect(() => {
    if (!mounted) return;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !requestPending.current) onClose();
      if (event.key !== "Tab") return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href]");
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [mounted, onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true; setError(null); setIsSubmitting(true);
    try {
      if (mode === "login") await login({ username_or_email: usernameOrEmail, password });
      else await register({ username: usernameOrEmail, email, full_name: fullName, password });
      setPassword(""); onClose();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : `${mode === "login" ? "Sign in" : "Sign up"} failed. Please try again.`); }
    finally { requestPending.current = false; setIsSubmitting(false); }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="auth-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose(); }}>
      <div className="auth-modal-container" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" ref={dialogRef}>
        <button type="button" className="auth-modal-close" aria-label="Close sign in" disabled={isSubmitting} onClick={onClose}>×</button>
        <aside className="auth-modal-aside" aria-label="Learn Fast introduction">
          <a className="auth-modal-brand" href="/" aria-label="Learn Fast home">
            <span className="auth-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 5.5c2.8-.8 5.3-.4 7.5 1.2v12c-2.2-1.6-4.7-2-7.5-1.2z" />
                <path d="M19.5 5.5c-2.8-.8-5.3-.4-7.5 1.2v12c2.2-1.6 4.7-2 7.5-1.2z" />
              </svg>
            </span>
            <span>Learn Fast</span>
          </a>
          <div className="auth-aside-copy">
            <span className="auth-eyebrow">A little practice, every day</span>
            <h2>Make English part of your everyday.</h2>
            <p>Build a steady learning habit with focused practice that fits your day.</p>
          </div>
          <div className="auth-preview-card" aria-hidden="true">
            <div className="auth-preview-topline"><span className="auth-preview-dot" /><span>Today’s progress</span></div>
            <div className="auth-preview-progress"><span /></div>
            <div className="auth-preview-bottomline"><strong>Small steps add up.</strong><span>12 min</span></div>
          </div>
          <p className="auth-aside-caption">Your personal space to learn, remember, and grow.</p>
        </aside>

        <section className="auth-modal-content">
          <header className="auth-modal-header">
            <span className="auth-form-kicker">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span>
            <h1 id="auth-dialog-title">{mode === "login" ? "Sign in" : "Create your account"}</h1>
            <p>{mode === "login" ? "Pick up where your learning left off." : "Set up your account and start building your English."}</p>
          </header>
          {error && <div className="auth-error-alert" role="alert">{error}</div>}
          <form className="auth-form-body" onSubmit={submit}>
            {mode === "register" && <>
              <div className="auth-input-group"><label htmlFor="auth-full-name">Full name</label><input id="auth-full-name" type="text" placeholder="Your name" required autoComplete="name" value={fullName} disabled={isSubmitting} onChange={(event) => setFullName(event.target.value)} /></div>
              <div className="auth-input-group"><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" placeholder="you@example.com" required autoComplete="email" value={email} disabled={isSubmitting} onChange={(event) => setEmail(event.target.value)} /></div>
            </>}
            <div className="auth-input-group"><label htmlFor="auth-login-identifier">{mode === "login" ? "Username or email" : "Username"}</label><input id="auth-login-identifier" type="text" placeholder={mode === "login" ? "Your username or email" : "Choose a username"} required autoComplete="username" value={usernameOrEmail} disabled={isSubmitting} onChange={(event) => setUsernameOrEmail(event.target.value)} /></div>
            <div className="auth-input-group"><label htmlFor="auth-login-password">Password</label><div className="auth-input-wrapper"><input id="auth-login-password" type={showPassword ? "text" : "password"} placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"} required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} disabled={isSubmitting} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} disabled={isSubmitting} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></div>
            <button type="submit" className="auth-submit-btn" disabled={isSubmitting} aria-busy={isSubmitting}>
              <span>{isSubmitting ? (mode === "login" ? "Signing in…" : "Creating account…") : mode === "login" ? "Sign in" : "Create account"}</span>
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <div className="auth-modal-footer"><p>{mode === "login" ? "New to Learn Fast?" : "Already have an account?"} <button className="auth-toggle-link" type="button" disabled={isSubmitting} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>{mode === "login" ? "Create an account" : "Sign in"}</button></p></div>
          <p className="auth-guest-note">Just exploring? <a href="/workbooks">Browse the public sample</a></p>
        </section>
      </div>
    </div>,
    document.body,
  );
}
