export type IELTSSkill = "reading" | "listening";
export type IELTSChoice = { id: string; text: string };
export type IELTSQuestion = {
  id: string;
  type: "multiple_choice" | "true_false_not_given" | "completion";
  prompt: string;
  options: IELTSChoice[];
  max_words: number | null;
};
export type IELTSSource = {
  id: number;
  source_type: "text" | "video";
  title: string;
  word_count: number;
  video_id: string | null;
  start_seconds: number | null;
  end_seconds: number | null;
  reading_opened: boolean;
};
export type IELTSTestSet = {
  id: number;
  source: IELTSSource;
  status: "generating" | "ready" | "failed";
  skills: "reading" | "listening" | "both";
  count_per_skill: number;
  error_code: string | null;
  questions: Partial<Record<IELTSSkill, IELTSQuestion[]>>;
};
export type IELTSReview = {
  id: string;
  correct: boolean;
  answer: string;
  accepted_answers: string[];
  evidence_quote: string;
  evidence_segment: number | null;
  evidence_start: number | null;
  evidence_duration: number | null;
  explanation_en: string;
  explanation_vi: string;
  distractor_explanations: Record<string, string>;
};
export type IELTSAttempt = {
  id: number;
  test_set_id: number;
  skill: IELTSSkill;
  status: "draft" | "submitted";
  answers: Record<string, string>;
  score: number | null;
  total: number;
  reading_opened: boolean;
  review?: IELTSReview[];
};
