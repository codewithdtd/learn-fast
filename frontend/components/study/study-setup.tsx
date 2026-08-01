"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ApiRequestError,
  createStudySession,
  getSheet,
  type SheetDetail,
  type StudyDirection,
  type StudySessionType,
} from "@/services/api";

type StudySetupProps = {
  sheetId: string;
  initialMode: "default" | "review";
};

type Choice<T extends string> = {
  value: T;
  label: string;
  description: string;
};

const directionChoices: Choice<StudyDirection>[] = [
  {
    value: "en_to_vi",
    label: "English → Vietnamese",
    description: "See the English phrase and recall its Vietnamese meaning.",
  },
  {
    value: "vi_to_en",
    label: "Vietnamese → English",
    description: "See the meaning and recall the English phrase.",
  },
  {
    value: "mixed",
    label: "Mixed",
    description: "Alternate the question direction by the card import order.",
  },
];

const sourceChoices: Choice<StudySessionType>[] = [
  {
    value: "new_learning",
    label: "All cards",
    description: "Study every flashcard in this sheet.",
  },
  {
    value: "weak_cards",
    label: "Weak cards only",
    description: "Study only flashcards already marked Weak.",
  },
];

export function StudySetupView({ sheetId, initialMode }: StudySetupProps) {
  const router = useRouter();
  const isReviewMode = initialMode === "review";
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [direction, setDirection] = useState<StudyDirection>("en_to_vi");
  const [sessionType, setSessionType] = useState<StudySessionType>(
    isReviewMode ? "srs_review" : "new_learning",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function loadSheet() {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      setSheet(await getSheet(sheetId));
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
        setNotFound(true);
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load this sheet.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    void getSheet(sheetId)
      .then((loadedSheet) => {
        if (isCurrent) setSheet(loadedSheet);
      })
      .catch((caughtError: unknown) => {
        if (!isCurrent) return;
        if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
          setNotFound(true);
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load this sheet.",
        );
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [sheetId]);

  async function startStudy() {
    if (!sheet || isStarting) return;

    setIsStarting(true);
    setError(null);
    try {
      const session = await createStudySession({
        sheet_id: sheet.id,
        session_type: sessionType,
        direction,
      });
      router.push(`/study-sessions/${session.id}`);
    } catch (caughtError) {
      if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
        setNotFound(true);
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not start a study session. Please try again.",
        );
      }
    } finally {
      setIsStarting(false);
    }
  }

  if (isLoading) return <PageMessage>Loading study setup…</PageMessage>;
  if (notFound) return <NotFound />;
  if (error && !sheet) return <RetryError message={error} onRetry={loadSheet} />;
  if (!sheet) return null;

  return (
    <section>
      <Link
        href={`/sheets/${sheet.id}`}
        className="text-sm font-medium text-sky-700 hover:underline"
      >
        ← {sheet.name}
      </Link>
      <div className="mt-4">
        <p className="text-sm text-slate-500">{sheet.workbook.name}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{isReviewMode ? "Scheduled Review" : "Start Flashcard Study"}</h1>
          <p className="mt-2 text-slate-600">
          {isReviewMode
            ? `Review all ${sheet.card_count} cards scheduled for this sheet. Starting creates a new saved review session.`
            : `Choose how to practise ${sheet.card_count} cards. Starting creates a new saved session.`}
        </p>
      </div>

      <form
        className="mt-8 space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          void startStudy();
        }}
      >
        <ChoiceGroup
          legend="Study direction"
          name="study-direction"
          choices={directionChoices}
          selectedValue={direction}
          isDisabled={isStarting}
          onChange={setDirection}
        />
        {isReviewMode ? (
          <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
            <h2 className="font-semibold">Scheduled review</h2>
            <p className="mt-1 text-sm">This session includes all cards and will update the sheet&apos;s SRS schedule after completion.</p>
          </section>
        ) : (
          <ChoiceGroup
            legend="Cards to include"
            name="study-source"
            choices={sourceChoices}
            selectedValue={sessionType}
            isDisabled={isStarting}
            onChange={setSessionType}
          />
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            {error}
          </p>
        )}
        {isReviewMode && error && (
          <Link href="/" className="inline-block text-sm font-semibold text-sky-700 hover:underline">
            Return to dashboard
          </Link>
        )}
        <button
          type="submit"
          disabled={isStarting}
          className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isStarting ? "Creating session…" : "Start study"}
        </button>
      </form>
    </section>
  );
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  choices,
  selectedValue,
  isDisabled,
  onChange,
}: {
  legend: string;
  name: string;
  choices: Choice<T>[];
  selectedValue: T;
  isDisabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-lg font-semibold text-slate-900">{legend}</legend>
      <div className="mt-3 grid gap-3">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 bg-white p-4 has-[:checked]:border-sky-600 has-[:checked]:ring-2 has-[:checked]:ring-sky-100 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={selectedValue === choice.value}
              disabled={isDisabled}
              onChange={() => onChange(choice.value)}
              className="mt-1 size-4 accent-sky-700"
            />
            <span>
              <span className="block font-semibold text-slate-900">{choice.label}</span>
              <span className="mt-1 block text-sm text-slate-600">{choice.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function PageMessage({ children }: { children: React.ReactNode }) {
  return <p className="mt-8 text-slate-600">{children}</p>;
}

function NotFound() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-xl font-semibold">Sheet not found</h1>
      <Link href="/workbooks" className="mt-4 inline-block text-sky-700 hover:underline">
        Back to workbooks
      </Link>
    </section>
  );
}

function RetryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
      <p>{message}</p>
      <button
        type="button"
        onClick={() => void onRetry()}
        className="mt-3 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold"
      >
        Try again
      </button>
    </section>
  );
}
