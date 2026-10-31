export type SpeakingHint = { en: string; vi: string };

export type SpeakingPrompt = {
  id: number;
  slug: string;
  title_en: string;
  title_vi: string;
  question_en: string;
  question_vi: string;
  category: string;
  difficulty: string;
  hints: SpeakingHint[];
};

export type SpeakingPromptList = { items: SpeakingPrompt[] };

export type SpeakingCriterion = {
  score: number;
  feedback_en: string;
  feedback_vi: string;
};

export type SpeakingExample = {
  quote: string;
  suggestion_en: string;
  suggestion_vi: string;
  reason_en: string;
  reason_vi: string;
};

export type SpeakingBilingualText = { en: string; vi: string };

export type SpeakingFeedback = {
  schema_version: "1";
  relevance: SpeakingCriterion;
  coherence: SpeakingCriterion;
  vocabulary: SpeakingCriterion;
  grammar: SpeakingCriterion;
  summary_en: string;
  summary_vi: string;
  strengths: SpeakingBilingualText[];
  improvements: SpeakingExample[];
  next_steps: SpeakingBilingualText[];
};

export type SpeakingStatus = "created" | "transcribing" | "ready" | "grading" | "graded" | "failed";

export type SpeakingAttempt = {
  id: number;
  prompt_id: number;
  prompt_snapshot: SpeakingPrompt;
  transcript: string;
  status: SpeakingStatus;
  version: number;
  quota_consumed: boolean;
  created_at: string;
  updated_at: string;
  graded_at: string | null;
  feedback: SpeakingFeedback | null;
  error_code: string | null;
};

export type SpeakingAttemptSummary = {
  id: number;
  prompt_id: number;
  title_en: string;
  category: string;
  status: SpeakingStatus;
  created_at: string;
  graded_at: string | null;
};

export type SpeakingAttemptList = { items: SpeakingAttemptSummary[]; total: number };
export type SpeakingUsage = { usage_date: string; daily_limit: number | null; used: number; remaining: number | null };
