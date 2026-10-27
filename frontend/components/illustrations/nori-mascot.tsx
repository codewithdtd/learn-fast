import { useId } from "react";
import styles from "./illustrations.module.css";

type NoriPose = "welcome" | "guide" | "celebrate" | "rest";

type NoriMascotProps = {
  pose?: NoriPose;
  size?: number;
  className?: string;
  title?: string;
};

export function NoriMascot({ pose = "welcome", size = 112, className, title }: NoriMascotProps) {
  const titleId = useId();
  const accessibleTitleId = title ? titleId : undefined;
  const classes = [styles.nori, className].filter(Boolean).join(" ");

  return (
    <svg
      className={classes}
      width={size}
      height={Math.round(size * 0.88)}
      viewBox="0 0 128 112"
      role={title ? "img" : undefined}
      aria-labelledby={accessibleTitleId}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title id={titleId}>{title}</title>}
      {pose === "celebrate" && <path className={styles.noriStar} d="m105 9 3.7 7.6 8.4 1.2-6.1 5.9 1.4 8.3-7.4-3.9-7.5 3.9 1.5-8.3-6.1-5.9 8.4-1.2Z" />}
      <path className={styles.noriBody} d="M27 73c0-18 14-32 34-32h14c17 0 29 12 29 29v12c0 9-7 15-17 15H48c-13 0-21-9-21-24Z" />
      <path className={styles.noriBelly} d="M47 68c3-9 11-14 22-14s19 6 21 15v11c0 7-5 11-12 11H56c-7 0-11-4-11-11Z" />
      <path className={styles.noriBag} d="M84 58c8 1 15 7 16 15l1 16c0 5-4 8-9 8H78l3-21Z" />
      <path className={styles.noriBagAccent} d="M86 74h12v11H86z" />
      <path className={styles.noriBody} d="M32 47c2-17 14-29 31-29 16 0 29 11 31 27l-7 8H39Z" />
      <path className={styles.noriBelly} d="M41 44c2-10 9-17 21-17s20 7 22 17Z" />
      <ellipse className={styles.noriEye} cx="53" cy="43" rx="2.6" ry="3.4" />
      <ellipse className={styles.noriEye} cx="72" cy="43" rx="2.6" ry="3.4" />
      <ellipse className={styles.noriCheek} cx="46" cy="49" rx="4" ry="2.2" />
      <ellipse className={styles.noriCheek} cx="79" cy="49" rx="4" ry="2.2" />
      <path className={styles.noriLine} d="M57 52q5 5 10 0" />
      {pose === "welcome" && <>
        <path className={styles.noriLine} d="M30 68q-9-10-15-19" />
        <path className={styles.noriBody} d="M10 45q-3-8 2-12l6 5 5-6q5 8 1 14l-7 4Z" />
        <path className={styles.noriCard} d="M1 70h20v27H1z" />
        <path className={styles.noriLine} d="M6 78h10M6 84h8" />
      </>}
      {pose === "guide" && <>
        <path className={styles.noriLine} d="M32 69q-8 2-13 1" />
        <path className={styles.noriLine} d="m16 68 5 2-4 4" />
        <path className={styles.noriBook} d="M2 77q9-5 18 0v23q-9-5-18 0Zm18 0q9-5 18 0v23q-9-5-18 0Z" />
        <path className={styles.noriLine} d="M20 77v23" />
      </>}
      {pose === "celebrate" && <>
        <path className={styles.noriLine} d="M31 65q-8-13-12-23" />
        <path className={styles.noriBody} d="M13 42q-5-8 1-13l6 7 6-6q5 8 0 14l-7 3Z" />
        <path className={styles.noriLine} d="M93 64q8-11 12-22" />
        <path className={styles.noriBody} d="M103 41q-4-8 2-13l5 7 6-6q5 8 0 14l-7 3Z" />
      </>}
      {pose === "rest" && <>
        <path className={styles.noriLine} d="M34 72q-8 5-14 12" />
        <path className={styles.noriBook} d="M1 83q9-5 18 0v18q-9-5-18 0Zm18 0q9-5 18 0v18q-9-5-18 0Z" />
        <path className={styles.noriLine} d="M19 83v18M50 41q3-4 6 0m12 0q3-4 6 0" />
      </>}
      <path className={styles.noriLine} d="M52 98v6m25-6v6M43 105h13m14 0h13" />
    </svg>
  );
}
