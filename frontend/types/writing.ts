export type WritingHint = {
  idea_vi: string;
  question_en: string;
  frame_en: string;
};

export type BilingualItem = { vi: string; en: string };

export type SentencePracticeContext = {
  flashcard_id: number;
  sheet_id: number;
  phrase: string;
  meaning: string;
  idea: BilingualItem;
  frame: BilingualItem;
  example: BilingualItem;
};

export type ParagraphWord = { id: number; phrase: string; meaning: string };
export type ParagraphPracticeTask = {
  sheet_id: number; title_en: string; title_vi: string; paragraph_vi: string;
  style: "paragraph" | "dialogue"; words: ParagraphWord[];
};

export type WritingParagraphHints = {
  sentence_practice?: SentencePracticeContext;
  vocabulary_translation?: ParagraphPracticeTask;
  opening_vi: string;
  opening_en: string;
  details_vi: string;
  details_en: string;
  closing_vi: string;
  closing_en: string;
  connectors: BilingualItem[];
  vocabulary: BilingualItem[];
};

export type WritingPrompt = {
  id: number;
  slug: string;
  title_vi: string;
  title_en: string;
  prompt_vi: string;
  prompt_en: string;
  difficulty: string;
  format: string;
  target_word_count: number;
  sentence_hints: WritingHint[];
  paragraph_hints: WritingParagraphHints;
  content_version: number;
  is_daily_suggestion?: boolean;
};

export type GuestWritingTopic = Omit<WritingPrompt, "id" | "slug" | "content_version" | "is_daily_suggestion">;

export type WritingAttemptStatus = "draft" | "grading" | "graded" | "failed";

export type WritingCriterionScore = {
  score: number;
  explanation_vi: string;
  explanation_en: string;
};

export type WritingIssue = {
  id: string;
  kind: "error" | "suggestion";
  category: "grammar" | "tense" | "vocabulary" | "word_order" | "spelling_punctuation" | "coherence";
  operation: "replace" | "delete" | "insert";
  quote: string;
  occurrence: number;
  anchor_position: "before" | "after" | null;
  replacement: string;
  explanation_vi: string;
  explanation_en: string;
  rule_vi: string;
  rule_en: string;
  example_vi: string;
  example_en: string;
  start: number;
  end: number;
};

export type WritingStrength = {
  quote: string;
  occurrence: number;
  note_vi: string;
  note_en: string;
  start: number;
  end: number;
};

export type WritingFeedback = {
  schema_version: string;
  rubric_version: string;
  task_response: WritingCriterionScore;
  coherence: WritingCriterionScore;
  vocabulary: WritingCriterionScore;
  grammar: WritingCriterionScore;
  practice_score: number;
  summary_vi: string;
  summary_en: string;
  strengths: WritingStrength[];
  issues: WritingIssue[];
  corrected_text: string;
  next_steps: string[];
};

export type WritingAttempt = {
  id: number;
  prompt_id: number;
  prompt_snapshot: WritingPrompt;
  revision_of_id: number | null;
  draft_text: string;
  submitted_text: string | null;
  word_count: number;
  status: WritingAttemptStatus;
  version: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  graded_at: string | null;
  grading_expires_at: string | null;
  feedback: WritingFeedback | null;
  error_code: string | null;
};

export type WritingAttemptSummary = {
  id: number;
  prompt_id: number;
  title_en: string;
  title_vi: string;
  status: WritingAttemptStatus;
  word_count: number;
  practice_score: number | null;
  created_at: string;
  graded_at: string | null;
  revision_of_id: number | null;
};

export type WritingAttemptList = {
  items: WritingAttemptSummary[];
  total: number;
  page: number;
  page_size: number;
};

export type WritingErrorHistory = {
  items: { attempt_id: number; title_en: string; graded_at: string | null; issues: WritingIssue[] }[];
  total: number; page: number; page_size: number;
};

export type WritingPromptList = { items: WritingPrompt[]; suggested_prompt_id: number | null };
export type WritingUsage = { usage_date: string; daily_limit: number | null; used: number; remaining: number | null };
