import type { FlashcardListItem } from "@/services/api";
import type { RecallDirection, RecallFilter } from "@/lib/quick-recall";

export type ExerciseMode = "multiple_choice" | "translation" | "cloze";
export type ExerciseCount = "10" | "20" | "all";

export type ExerciseSettings = {
  mode: ExerciseMode;
  direction: RecallDirection;
  filter: RecallFilter;
  count: ExerciseCount;
};

export type ExerciseQuestion = {
  cardId: number;
  prompt: string;
  answer: string;
  hint: string | null;
  options: string[];
};

export type ExerciseResponse = {
  question: ExerciseQuestion;
  answer: string;
  is_correct: boolean;
  confidence_rating: 1 | 3;
};

export function normalizeExerciseAnswer(value: string): string {
  // Giữ nguyên dấu tiếng Việt; chỉ bỏ khác biệt trình bày, không suy đoán từ đồng nghĩa.
  return value.normalize("NFKC").toLowerCase().replace(/\p{P}/gu, "").trim().replace(/\s+/gu, " ");
}

export function gradeExerciseAnswer(question: ExerciseQuestion, answer: string): ExerciseResponse {
  const normalized = normalizeExerciseAnswer(answer);
  const isCorrect = normalized.length > 0 && normalized === normalizeExerciseAnswer(question.answer);
  // Ánh xạ cùng chuẩn Again/Good của bài học, nhưng kết quả này chỉ ở bộ nhớ,
  // tuyệt đối không gửi rating hay đáp án sang API cập nhật SRS.
  return { question, answer, is_correct: isCorrect, confidence_rating: isCorrect ? 3 : 1 };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[next]] = [shuffled[next], shuffled[index]];
  }
  return shuffled;
}

function createClozeQuestion(card: FlashcardListItem): ExerciseQuestion | null {
  const phrase = card.phrase.normalize("NFKC").trim();
  const example = card.example_en?.normalize("NFKC").trim();
  if (!normalizeExerciseAnswer(phrase) || !example) return null;
  const pattern = phrase.split(/\s+/u).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
  // Không khớp 'take' trong 'mistake'. Prefix không dùng lookbehind để hỗ trợ
  // Safari cũ; ẩn mọi lần xuất hiện để phần còn lại của câu không lộ đáp án.
  const matcher = new RegExp(`(^|[^\\p{L}\\p{N}_])(${pattern})(?=$|[^\\p{L}\\p{N}_])`, "giu");
  const firstMatch = matcher.exec(example);
  if (!firstMatch) return null;
  const prompt = example.replace(matcher, (_match, prefix: string) => `${prefix}____`);
  if (!normalizeExerciseAnswer(prompt.replaceAll("____", ""))) return null;
  return { cardId: card.id, prompt, answer: firstMatch[2], hint: card.meaning, options: [] };
}

export function createExercisePool(
  cards: readonly FlashcardListItem[],
  settings: Pick<ExerciseSettings, "mode" | "direction" | "filter">,
): ExerciseQuestion[] {
  const selectedCards = cards.filter((card) => settings.filter === "all"
    || (settings.filter === "weak" ? card.is_weak : card.is_bookmarked));
  if (settings.mode === "cloze") {
    return selectedCards.flatMap((card) => {
      const question = createClozeQuestion(card);
      return question ? [question] : [];
    });
  }

  const sides = (card: FlashcardListItem) => settings.direction === "en_to_vi"
    ? { prompt: card.phrase, answer: card.meaning }
    : { prompt: card.meaning, answer: card.phrase };
  const answersByPrompt = new Map<string, Set<string>>();
  const uniqueAnswers = new Map<string, string>();
  for (const card of cards) {
    const { prompt, answer } = sides(card);
    const promptKey = normalizeExerciseAnswer(prompt);
    const answerKey = normalizeExerciseAnswer(answer);
    if (!promptKey || !answerKey) continue;
    const answers = answersByPrompt.get(promptKey) ?? new Set<string>();
    answers.add(answerKey);
    answersByPrompt.set(promptKey, answers);
    uniqueAnswers.set(answerKey, answer);
  }
  if (settings.mode === "multiple_choice" && uniqueAnswers.size < 2) return [];

  const options = settings.mode === "multiple_choice" ? [...uniqueAnswers.values()] : [];
  const seen = new Set<string>();
  return selectedCards.flatMap((card) => {
    const { prompt, answer } = sides(card);
    const promptKey = normalizeExerciseAnswer(prompt);
    // Một prompt có nhiều đáp án mẫu khác nhau không thể chấm chính xác bằng
    // so khớp cố định, nên bỏ câu mơ hồ và gộp những thẻ trùng hoàn toàn.
    if (!promptKey || !normalizeExerciseAnswer(answer)
      || answersByPrompt.get(promptKey)?.size !== 1 || seen.has(promptKey)) return [];
    seen.add(promptKey);
    return [{ cardId: card.id, prompt, answer, hint: null, options }];
  });
}

export function buildExerciseQuestions(
  cards: readonly FlashcardListItem[],
  settings: ExerciseSettings,
  random: () => number = Math.random,
): ExerciseQuestion[] {
  const pool = createExercisePool(cards, settings);
  const count = settings.count === "all" ? pool.length : Math.min(Number(settings.count), pool.length);
  // Chốt snapshot khi bấm Start; nhập đáp án và render lại không được đảo câu/phương án.
  return shuffle(pool, random).slice(0, count).map((question) => {
    if (settings.mode !== "multiple_choice") return question;
    const distractors = question.options.filter((option) =>
      normalizeExerciseAnswer(option) !== normalizeExerciseAnswer(question.answer));
    return { ...question, options: shuffle([question.answer, ...shuffle(distractors, random).slice(0, 3)], random) };
  });
}

export function summarizeExercise(responses: readonly ExerciseResponse[]) {
  const correct = responses.filter((response) => response.is_correct).length;
  return { correct, total: responses.length,
    percentage: responses.length ? Math.round(correct / responses.length * 1000) / 10 : 0 };
}
