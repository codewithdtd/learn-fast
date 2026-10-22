"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/context/auth-context";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login";
}

const subscribeToNothing = () => () => undefined;
const getClientMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  // Mỗi lần mở là form mới, tránh giữ mật khẩu hoặc lỗi cũ sau khi người dùng đóng hộp thoại.
  return isOpen ? <AdministratorSignIn onClose={onClose} /> : null;
}

function AdministratorSignIn({ onClose }: Pick<AuthModalProps, "onClose">) {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
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
    try { await login({ username_or_email: usernameOrEmail, password }); setPassword(""); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Sign in failed. Please try again."); }
    finally { requestPending.current = false; setIsSubmitting(false); }
  }

  if (!mounted) return null;
  return createPortal(<div className="auth-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !isSubmitting) onClose(); }}>
    <div className="auth-modal-container" role="dialog" aria-modal="true" aria-labelledby="admin-sign-in-title" ref={dialogRef}>
      <button type="button" className="auth-modal-close" aria-label="Close sign in" disabled={isSubmitting} onClick={onClose}>×</button>
      <header className="auth-modal-header"><h2 id="admin-sign-in-title">Administrator sign in</h2><p>Sign in with an administrator account for full access. Visitors can explore the public sample sheet.</p></header>
      {error && <div className="auth-error-alert" role="alert">{error}</div>}
      <form className="auth-form-body" onSubmit={submit}>
        <div className="auth-input-group"><label htmlFor="auth-login-identifier">Username or email</label><div className="auth-input-wrapper"><input id="auth-login-identifier" type="text" required autoComplete="username" value={usernameOrEmail} disabled={isSubmitting} onChange={(event) => setUsernameOrEmail(event.target.value)} /></div></div>
        <div className="auth-input-group"><label htmlFor="auth-login-password">Password</label><div className="auth-input-wrapper"><input id="auth-login-password" type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} disabled={isSubmitting} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="auth-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} disabled={isSubmitting} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></div>
        <button type="submit" className="auth-submit-btn" disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</button>
      </form>
      <div className="auth-modal-footer"><p>Accounts are managed by the administrator.</p></div>
    </div>
  </div>, document.body);
}
