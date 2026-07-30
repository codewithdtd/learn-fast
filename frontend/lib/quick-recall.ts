import type { FlashcardListItem } from "@/services/api";

export type RecallDirection = "en_to_vi" | "vi_to_en";
export type RecallFilter = "all" | "weak" | "bookmarked";

export type RecallSides = {
  question: string;
  answer: string;
  questionLabel: "Phrase" | "Meaning";
  answerLabel: "Phrase" | "Meaning";
};

export function getRecallSides(
  card: FlashcardListItem,
  direction: RecallDirection,
): RecallSides {
  if (direction === "vi_to_en") {
    return {
      question: card.meaning,
      answer: card.phrase,
      questionLabel: "Meaning",
      answerLabel: "Phrase",
    };
  }

  return {
    question: card.phrase,
    answer: card.meaning,
    questionLabel: "Phrase",
    answerLabel: "Meaning",
  };
}

export function filterRecallCards(
  cards: FlashcardListItem[],
  filter: RecallFilter,
): FlashcardListItem[] {
  if (filter === "weak") return cards.filter((card) => card.is_weak);
  if (filter === "bookmarked") return cards.filter((card) => card.is_bookmarked);
  return cards;
}

export function orderCardsByIds(
  cards: FlashcardListItem[],
  orderedCardIds: number[],
): FlashcardListItem[] {
  const cardsById = new Map(cards.map((card) => [card.id, card]));
  return orderedCardIds.flatMap((cardId) => {
    const card = cardsById.get(cardId);
    return card ? [card] : [];
  });
}

export function shuffleCardIds(cardIds: number[], random = Math.random): number[] {
  const shuffledIds = [...cardIds];

  // Shuffle IDs, not card objects: reveal state is keyed by card ID and must
  // remain attached to the same flashcard after its visual row moves.
  for (let currentIndex = shuffledIds.length - 1; currentIndex > 0; currentIndex -= 1) {
    const randomIndex = Math.floor(random() * (currentIndex + 1));
    [shuffledIds[currentIndex], shuffledIds[randomIndex]] = [
      shuffledIds[randomIndex],
      shuffledIds[currentIndex],
    ];
  }

  return shuffledIds;
}
