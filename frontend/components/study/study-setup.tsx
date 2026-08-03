"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/layout/app-shell";
import { ApiRequestError, createStudySession, getSheet, type SheetDetail, type StudyDirection, type StudySessionType } from "@/services/api";

type StudySetupProps = { sheetId: string; initialMode: "default" | "review" };
type Choice<T extends string> = { value: T; label: string; description: string; icon: "arrow" | "review" | "weak" | "books" };

const directionChoices: Choice<StudyDirection>[] = [
  { value: "en_to_vi", label: "English to Vietnamese", description: "See the English phrase and recall its Vietnamese meaning.", icon: "arrow" },
  { value: "vi_to_en", label: "Vietnamese to English", description: "See the meaning and recall the English phrase.", icon: "review" },
  { value: "mixed", label: "Mixed direction", description: "Alternate the question direction by card import order.", icon: "arrow" },
];

const sourceChoices: Choice<StudySessionType>[] = [
  { value: "new_learning", label: "All cards", description: "Study every flashcard in this sheet.", icon: "books" },
  { value: "weak_cards", label: "Weak cards only", description: "Study flashcards already marked Weak.", icon: "weak" },
];

export function StudySetupView({ sheetId, initialMode }: StudySetupProps) {
  const router = useRouter();
  const isReviewMode = initialMode === "review";
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [direction, setDirection] = useState<StudyDirection>("en_to_vi");
  const [sessionType, setSessionType] = useState<StudySessionType>(isReviewMode ? "srs_review" : "new_learning");
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function loadSheet() {
    setIsLoading(true); setError(null); setNotFound(false);
    try { setSheet(await getSheet(sheetId)); }
    catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) setNotFound(true);
      else setError(caughtError instanceof Error ? caughtError.message : "Could not load this sheet.");
    }
    finally { setIsLoading(false); }
  }

  useEffect(() => {
    let isCurrent = true;
    void getSheet(sheetId).then((loadedSheet) => {
      if (isCurrent) setSheet(loadedSheet);
    }).catch((caughtError: unknown) => {
      if (!isCurrent) return;
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) { setNotFound(true); return; }
      setError(caughtError instanceof Error ? caughtError.message : "Could not load this sheet.");
    }).finally(() => { if (isCurrent) setIsLoading(false); });
    return () => { isCurrent = false; };
  }, [sheetId]);

  async function startStudy() {
    if (!sheet || isStarting) return;
    setIsStarting(true); setError(null);
    try {
      const session = await createStudySession({ sheet_id: sheet.id, session_type: sessionType, direction });
      router.push(`/study-sessions/${session.id}`);
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) setNotFound(true);
      else setError(caughtError instanceof Error ? caughtError.message : "Could not start a study session. Please try again.");
    } finally { setIsStarting(false); }
  }

  if (isLoading) return <StudyState>Loading study setup…</StudyState>;
  if (notFound) return <NotFound />;
  if (error && !sheet) return <RetryError message={error} onRetry={loadSheet} />;
  if (!sheet) return null;

  return (
    <section className="study-setup-content">
      <header className="study-setup-header">
        <nav className="study-setup-breadcrumb" aria-label="Breadcrumb"><Link href="/workbooks">Workbooks</Link><span>›</span><Link href={`/workbooks/${sheet.workbook.id}`}>{sheet.workbook.name}</Link><span>›</span><Link href={`/sheets/${sheet.id}`}>{sheet.name}</Link><span>›</span><span aria-current="page">Study</span></nav>
        <Link href={`/sheets/${sheet.id}`} className="study-setup-back"><Icon name="back" size={18} /> Back to sheet</Link>
        <div className="study-setup-title-row"><div><p className="study-setup-kicker">{isReviewMode ? "Scheduled review" : "Study setup"}</p><h1>{isReviewMode ? "Scheduled Review" : "Study Flashcards"}</h1><p>Sheet: <strong>{sheet.name}</strong> · {sheet.card_count} cards</p></div><span className="study-setup-status">{sheet.status.replaceAll("_", " ")}</span></div>
      </header>

      <form className="study-setup-layout" onSubmit={(event) => { event.preventDefault(); void startStudy(); }}>
        <div className="study-setup-options">
          <ChoiceGroup legend="Direction" choices={directionChoices} selectedValue={direction} isDisabled={isStarting} onChange={setDirection} />
          {isReviewMode ? <section className="study-review-notice"><div className="study-option-icon"><Icon name="review" size={22} /></div><div><h2>Scheduled review</h2><p>This session includes all {sheet.card_count} cards and updates the sheet&apos;s SRS schedule after completion.</p></div></section> : <ChoiceGroup legend="Card source" choices={sourceChoices} selectedValue={sessionType} isDisabled={isStarting} onChange={setSessionType} />}
        </div>

        <aside className="study-setup-summary"><p className="eyebrow">Session summary</p><h2>{isReviewMode ? "Review this sheet" : "Ready to learn?"}</h2><dl><SummaryRow label="Cards in sheet" value={String(sheet.card_count)} /><SummaryRow label="Direction" value={directionChoices.find((choice) => choice.value === direction)?.label ?? "Mixed direction"} /><SummaryRow label="Source" value={isReviewMode ? "Scheduled review" : sessionType === "weak_cards" ? "Weak cards only" : "All cards"} /><SummaryRow label="Sheet status" value={sheet.status.replaceAll("_", " ")} /></dl>{error && <p role="alert" className="study-setup-error">{error}</p>}<button type="submit" disabled={isStarting}>{isStarting ? "Creating session…" : "Start study session"}<Icon name="play" size={20} /></button>{isReviewMode && error && <Link href="/" className="study-dashboard-link">Return to dashboard</Link>}</aside>
      </form>
    </section>
  );
}

function ChoiceGroup<T extends string>({ legend, choices, selectedValue, isDisabled, onChange }: { legend: string; choices: Choice<T>[]; selectedValue: T; isDisabled: boolean; onChange: (value: T) => void }) {
  return <fieldset className="study-choice-group"><legend>{legend}</legend><div className={`study-choice-grid ${choices.length === 2 ? "two-columns" : "three-columns"}`}>{choices.map((choice) => <label key={choice.value} className={`study-choice-card${selectedValue === choice.value ? " is-selected" : ""}`}><input type="radio" value={choice.value} checked={selectedValue === choice.value} disabled={isDisabled} onChange={() => onChange(choice.value)} /><span className="study-option-icon"><Icon name={choice.icon} size={22} /></span><span className="study-choice-copy"><strong>{choice.label}</strong><small>{choice.description}</small></span><span className="study-radio" aria-hidden="true" /></label>)}</div></fieldset>;
}

function SummaryRow({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function StudyState({ children }: { children: React.ReactNode }) { return <section className="study-setup-state">{children}</section>; }
function NotFound() { return <section className="study-setup-state"><h1>Sheet not found</h1><Link href="/workbooks">Back to workbooks</Link></section>; }
function RetryError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) { return <section role="alert" className="study-setup-state study-setup-state-error"><p>{message}</p><button type="button" onClick={() => void onRetry()}>Try again</button></section>; }
