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

// Bảng tra quy chuẩn các dạng viết tắt thông dụng trong tiếng Anh để đồng nhất so khớp
export const CONTRACTION_MAP: [RegExp, string | ((match: string) => string)][] = [
  // Đại từ/danh từ + 's -> is (it's, that's, there's, what's, ...)
  [/\b(it|what|that|there|here|where|how|who|he|she)\s*['’]s\b/gi, "$1 is"],
  // I'm -> I am
  [/\b(i)\s*['’]m\b/gi, "$1 am"],
  // you're, we're, they're -> are
  [/\b(you|we|they)\s*['’]re\b/gi, "$1 are"],
  // will
  [/\b(i|you|he|she|we|they)\s*['’]ll\b/gi, "$1 will"],
  // would
  [/\b(i|you|he|she|we|they)\s*['’]d\b/gi, "$1 would"],
  // have
  [/\b(i|you|we|they)\s*['’]ve\b/gi, "$1 have"],
  // let's -> let us
  [/\blet\s*['’]s\b/gi, "let us"],
  // Phủ định đặc biệt
  [/\bwon\s*['’]t\b/gi, "will not"],
  [/\bcan\s*['’]t\b/gi, "can not"],
  [/\bcannot\b/gi, "can not"],
  [/\bshan\s*['’]t\b/gi, "shall not"],
  // Trợ động từ + n't -> verb not
  [/\b(do|does|did|is|are|was|were|have|has|had|would|could|should|must|need)\s*n['’]t\b/gi, "$1 not"],
  // Hỗ trợ trường hợp người học gõ nhanh bỏ qua dấu nháy đơn (dont, didnt, cant, wont, ...)
  [/\b(dont|didnt|doesnt|isnt|arent|wasnt|werent|havent|hasnt|hadnt|wouldnt|couldnt|shouldnt)\b/gi, (match) => {
    const base = match.toLowerCase().replace(/nt$/, "");
    return `${base} not`;
  }],
  [/\bwont\b/gi, "will not"],
  [/\bcant\b/gi, "can not"],
  [/\b(im)\b/gi, "i am"],
  [/\b(youre)\b/gi, "you are"],
  [/\b(theyre)\b/gi, "they are"],
  [/\b(its)\b/gi, "it is"],
];

export function expandContractions(text: string): string {
  let result = text;
  for (const [pattern, replacement] of CONTRACTION_MAP) {
    if (typeof replacement === "function") {
      result = result.replace(pattern, replacement);
    } else {
      result = result.replace(pattern, replacement);
    }
  }
  return result;
}

export function normalizeExerciseAnswer(value: string): string {
  // Chuẩn hóa viết tắt tiếng Anh trước khi xóa dấu câu; giữ nguyên dấu tiếng Việt; bỏ khoảng trắng thừa
  const expanded = expandContractions(value.normalize("NFKC"));
  return expanded
    .toLowerCase()
    .replace(/\p{P}/gu, "")
    .trim()
    .replace(/\s+/gu, " ");
}

export function gradeExerciseAnswer(
  question: ExerciseQuestion,
  answer: string,
  settings?: Pick<ExerciseSettings, "mode" | "direction">,
): ExerciseResponse {
  const normalized = normalizeExerciseAnswer(answer);
  const expected = normalizeExerciseAnswer(question.answer);

  const isDirectMatch = normalized.length > 0 && normalized === expected;
  // Bỏ qua khoảng cách khi so khớp (cho phép người dùng gõ thiếu hoặc thừa khoảng cách, ví dụ "takecare" vs "take care")
  const isCompactMatch =
    normalized.length > 0 &&
    expected.length > 0 &&
    normalized.replace(/\s+/gu, "") === expected.replace(/\s+/gu, "");

  // Nghĩa tiếng Việt đôi khi có giải thích dài, nên đáp án gõ EN → VI chỉ cần có trên 60% từ
  // khác nhau xuất hiện trong nghĩa mẫu. Chiều dịch và dạng bài còn lại giữ so khớp chính xác (cho phép châm chước khoảng cách).
  const matchesVietnameseMeaning = settings?.mode === "translation" && settings.direction === "en_to_vi"
    ? hasAnswerWordCoverage(expected, normalized) || isCompactMatch
    : isDirectMatch || isCompactMatch;

  const isCorrect = normalized.length > 0 && matchesVietnameseMeaning;
  // Ánh xạ cùng chuẩn Again/Good của bài học, nhưng kết quả này chỉ ở bộ nhớ,
  // tuyệt đối không gửi rating hay đáp án sang API cập nhật SRS.
  return { question, answer, is_correct: isCorrect, confidence_rating: isCorrect ? 3 : 1 };
}

function hasAnswerWordCoverage(expected: string, answer: string): boolean {
  if (!expected || !answer) return false;
  const expectedWords = new Set(expected.split(/\s+/u));
  const answerWords = [...new Set(answer.split(/\s+/u))];
  const matchedWords = answerWords.filter((word) => expectedWords.has(word)).length;
  return matchedWords / answerWords.length > 0.6;
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
