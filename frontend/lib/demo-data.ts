import type { FlashcardListItem, SheetDetail } from "@/services/api";

// Bộ mẫu công khai độc lập với DB; ID 0 chỉ phục vụ trình diễn, không gửi tới API sheet.
export const DEMO_CARDS: FlashcardListItem[] = [
  { id: 1, position: 1, phrase: "look forward to", meaning: "mong chờ", example_en: "I look forward to meeting the team.", example_vi: "Tôi mong được gặp nhóm." },
  { id: 2, position: 2, phrase: "catch up", meaning: "trò chuyện cập nhật tình hình", example_en: "Let's catch up over coffee tomorrow.", example_vi: "Mai mình cùng uống cà phê và trò chuyện nhé." },
  { id: 3, position: 3, phrase: "on the same page", meaning: "có cùng cách hiểu", example_en: "We are on the same page about the next step.", example_vi: "Chúng ta có cùng cách hiểu về bước tiếp theo." },
  { id: 4, position: 4, phrase: "take a break", meaning: "nghỉ giải lao", example_en: "Let's take a break after this meeting.", example_vi: "Mình nghỉ giải lao sau cuộc họp này nhé." },
  { id: 5, position: 5, phrase: "figure out", meaning: "tìm ra cách giải quyết", example_en: "We can figure out the problem together.", example_vi: "Chúng ta có thể cùng tìm cách giải quyết vấn đề." },
  { id: 6, position: 6, phrase: "keep in touch", meaning: "giữ liên lạc", example_en: "Let's keep in touch after the course.", example_vi: "Hãy giữ liên lạc sau khóa học nhé." },
  { id: 7, position: 7, phrase: "give it a try", meaning: "thử làm điều đó", example_en: "I will give it a try this weekend.", example_vi: "Tôi sẽ thử làm điều đó vào cuối tuần này." },
  { id: 8, position: 8, phrase: "make progress", meaning: "tiến bộ", example_en: "You make progress when you practice every day.", example_vi: "Bạn tiến bộ khi luyện tập mỗi ngày." },
].map((card) => ({ ...card, is_weak: card.id === 3 || card.id === 5, is_bookmarked: false }));

export const DEMO_SHEET: SheetDetail = {
  id: 0, name: "Everyday English — Sample", position: 1, card_count: DEMO_CARDS.length,
  status: "not_started", priority: "medium", next_review_at: null, first_learned_at: null,
  last_reviewed_at: null, srs_level: 0, interval_days: 0, review_count: 0, lapse_count: 0,
  workbook: { id: 0, name: "Public preview" },
};

export const DEMO_VIEWS = ["overview", "flashcards", "table", "exercises", "calendar", "import", "ai"] as const;
export type DemoView = typeof DEMO_VIEWS[number];
