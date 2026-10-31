"use client";

import { useEffect, useState } from "react";
import styles from "../cozy-dashboard.module.css";

const STORAGE_KEYS = {
  note1: "dtdflow_cozy_memo_focus",
  note2: "dtdflow_cozy_memo_scratchpad",
  note3: "dtdflow_cozy_memo_goals",
};

export function CozyMemosWidget() {
  const [mounted, setMounted] = useState(false);
  const [note1, setNote1] = useState("");
  const [note2, setNote2] = useState("");
  const [note3, setNote3] = useState("");

  useEffect(() => {
    setMounted(true);
    try {
      const saved1 = localStorage.getItem(STORAGE_KEYS.note1);
      const saved2 = localStorage.getItem(STORAGE_KEYS.note2);
      const saved3 = localStorage.getItem(STORAGE_KEYS.note3);

      if (saved1 !== null) setNote1(saved1);
      else setNote1("• Spend 15 mins reviewing due cards\n• Practice 1 speaking topic");

      if (saved2 !== null) setNote2(saved2);
      else setNote2("• serendipity (n): unexpected good luck\n• resilient (adj): recovering quickly");

      if (saved3 !== null) setNote3(saved3);
      else setNote3("• Keep 7-day study streak\n• Finish 2 workbooks before Sunday");
    } catch {
      // LocalStorage error fallback
    }
  }, []);

  function handleNoteChange(key: keyof typeof STORAGE_KEYS, value: string) {
    if (key === "note1") setNote1(value);
    if (key === "note2") setNote2(value);
    if (key === "note3") setNote3(value);

    try {
      localStorage.setItem(STORAGE_KEYS[key], value);
    } catch {
      // Silent fail
    }
  }

  return (
    <section className={styles.corkboardWrap} aria-labelledby="cozy-memos-title">
      <header className={styles.cardHeader} style={{ marginBottom: "16px" }}>
        <div className={styles.cardHeaderTitle}>
          <span className={styles.cardHeaderIcon} aria-hidden="true">📌</span>
          <h2 id="cozy-memos-title" className={styles.cardTitle}>Learner&apos;s Corkboard Memos</h2>
        </div>
        <span style={{ fontSize: "0.82rem", color: "#8c7664", fontWeight: 500 }}>
          Auto-saved locally
        </span>
      </header>

      <div className={styles.corkboardNotesGrid}>
        {/* Note 1: Today's Focus */}
        <div className={`${styles.stickyNote} ${styles.noteSand}`}>
          <div className={styles.stickyTape} aria-hidden="true" />
          <h3 className={styles.stickyNoteTitle}>
            <span aria-hidden="true">📝</span> Today&apos;s Focus
          </h3>
          <textarea
            className={styles.stickyTextarea}
            value={mounted ? note1 : ""}
            onChange={(e) => handleNoteChange("note1", e.target.value)}
            placeholder="What would you like to achieve today?"
            aria-label="Today's study focus notes"
          />
        </div>

        {/* Note 2: Quick Scratchpad */}
        <div className={`${styles.stickyNote} ${styles.noteSage}`}>
          <div className={styles.stickyTape} aria-hidden="true" />
          <h3 className={styles.stickyNoteTitle}>
            <span aria-hidden="true">💡</span> Vocabulary Scratchpad
          </h3>
          <textarea
            className={styles.stickyTextarea}
            value={mounted ? note2 : ""}
            onChange={(e) => handleNoteChange("note2", e.target.value)}
            placeholder="Jot down interesting words or grammar rules..."
            aria-label="Vocabulary scratchpad notes"
          />
        </div>

        {/* Note 3: Weekly Goal */}
        <div className={`${styles.stickyNote} ${styles.noteWarm}`}>
          <div className={styles.stickyTape} aria-hidden="true" />
          <h3 className={styles.stickyNoteTitle}>
            <span aria-hidden="true">🎯</span> Weekly Goal
          </h3>
          <textarea
            className={styles.stickyTextarea}
            value={mounted ? note3 : ""}
            onChange={(e) => handleNoteChange("note3", e.target.value)}
            placeholder="Set a weekly learning milestone..."
            aria-label="Weekly learning goal notes"
          />
        </div>
      </div>
    </section>
  );
}

