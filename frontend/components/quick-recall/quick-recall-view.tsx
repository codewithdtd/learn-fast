"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PracticeExerciseSession } from "@/components/quick-recall/practice-exercise-session";
import styles from "@/components/quick-recall/practice-exercises.module.css";
import { ApiRequestError, getSheet, getSheetCards, type FlashcardListItem, type SheetDetail } from "@/services/api";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; sheet: SheetDetail; cards: FlashcardListItem[] }
  | { status: "error"; message: string; notFound: boolean };

export function QuickRecallView({ sheetId }: { sheetId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [request, setRequest] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    // This exercise flow reads vocabulary only. Answers and scores never reach
    // the legacy Quick Recall completion API or the SRS update endpoints.
    void Promise.all([getSheet(sheetId), getSheetCards(sheetId)])
      .then(([sheet, cards]) => {
        if (isCurrent) setState({ status: "ready", sheet, cards });
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setState({ status: "error", notFound: error instanceof ApiRequestError && error.status === 404,
          message: error instanceof Error ? error.message : "Could not load practice exercises." });
      });
    return () => { isCurrent = false; };
  }, [sheetId, request]);

  if (state.status === "ready") {
    return <PracticeExerciseSession key={state.sheet.id} sheet={state.sheet} cards={state.cards} />;
  }
  if (state.status === "loading") {
    return <section className={styles.stateCard} aria-busy="true" role="status">
      <p className={styles.eyebrow}>Practice Exercises</p>
      <h1>Preparing your vocabulary</h1>
      <p>Loading the cards for this sheet...</p>
    </section>;
  }
  return <section className={styles.stateCard}>
    <h1>{state.notFound ? "Sheet not found" : "Could not load exercises"}</h1>
    <p role="alert">{state.notFound ? "This sheet is no longer available." : state.message}</p>
    <div className={styles.actions}>
      {!state.notFound && <button type="button" className={styles.primary} onClick={() => {
        setState({ status: "loading" });
        setRequest((value) => value + 1);
      }}>Try again</button>}
      <Link href="/workbooks" className={styles.secondary}>Back to workbooks</Link>
    </div>
  </section>;
}
