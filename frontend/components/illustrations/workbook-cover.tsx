import styles from "./illustrations.module.css";

type WorkbookCoverProps = { workbookId: number; className?: string };

export function WorkbookCover({ workbookId, className }: WorkbookCoverProps) {
  const variant = Math.abs(Math.trunc(workbookId)) % 4;
  const classes = [styles.coverWrap, "journey-only", className].filter(Boolean).join(" ");
  const accentClass = variant === 1 ? styles.coverAccentAlt : variant === 2 ? styles.coverAccentWarm : styles.coverAccent;

  return (
    <span className={classes} aria-hidden="true">
      <svg className={styles.workbookCover} viewBox="0 0 160 88" focusable="false">
        <rect className={styles.coverSurface} x="18" y="11" width="74" height="66" rx="8" />
        <path className={styles.coverOutline} d="M31 28h42m-42 10h31m-31 10h36" />
        <rect className={accentClass} x="103" y="22" width="36" height="43" rx={variant === 3 ? "18" : "7"} />
        {variant === 0 && <path className={styles.coverOutline} d="m110 49 10-17 12 17z" />}
        {variant === 1 && <path className={styles.coverOutline} d="M111 43h20m-10-10v20" />}
        {variant === 2 && <circle className={styles.coverSurface} cx="121" cy="43" r="9" />}
        {variant === 3 && <path className={styles.coverOutline} d="M112 43h18m-9-9v18" />}
      </svg>
    </span>
  );
}
