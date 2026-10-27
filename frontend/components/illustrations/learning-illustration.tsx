import styles from "./illustrations.module.css";

export type LearningIllustrationKind = "cards" | "calendar" | "writing" | "speaking" | "video";

export function LearningIllustration({ kind, className }: { kind: LearningIllustrationKind; className?: string }) {
  const classes = [styles.learningIllustration, className].filter(Boolean).join(" ");
  return (
    <svg className={classes} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {kind === "cards" && <>
        <rect className={styles.illustrationFill} x="13" y="14" width="29" height="36" rx="5" />
        <path className={styles.illustrationStroke} d="M21 26h13m-13 7h13m-13 7h8" />
        <path className={styles.illustrationFill} d="m43 18 6-4 8 12-6 4z" />
      </>}
      {kind === "calendar" && <>
        <rect className={styles.illustrationFill} x="9" y="13" width="46" height="39" rx="7" />
        <path className={styles.illustrationStroke} d="M10 24h44M21 9v9m22-9v9m-25 16h4m8 0h4m8 0h4m-28 8h4m8 0h4" />
        <path className={styles.illustrationStroke} d="m39 42 4 4 8-9" />
      </>}
      {kind === "writing" && <>
        <path className={styles.illustrationFill} d="m13 47 4-12 25-25a5 5 0 0 1 7 7L24 42Z" />
        <path className={styles.illustrationStroke} d="m36 14 13 13M12 53h40" />
      </>}
      {kind === "speaking" && <>
        <path className={styles.illustrationFill} d="M10 13h44v30H31L20 54v-11h-10z" />
        <path className={styles.illustrationStroke} d="M19 28h2m7 0h2m7 0h2m7 0h2M23 36q9 8 18 0" />
      </>}
      {kind === "video" && <>
        <rect className={styles.illustrationFill} x="8" y="13" width="48" height="38" rx="7" />
        <path className={styles.illustrationStroke} d="m27 23 14 9-14 9zM15 57h34" />
      </>}
    </svg>
  );
}
