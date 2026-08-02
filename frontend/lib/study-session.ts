import type {
  StudyAnswerDirection,
  StudyDirection,
  StudySessionCard,
} from "@/services/api";

export function getCardStudyDirection(
  sessionDirection: StudyDirection,
  sessionCard: StudySessionCard,
  cardIndex: number,
): StudyAnswerDirection {
  if (sessionCard.direction && sessionCard.direction !== "mixed") {
    return sessionCard.direction;
  }
  if (sessionDirection !== "mixed") {
    return sessionDirection;
  }

  // A mixed card has no persisted direction before its first answer. Alternate
  // by import order instead of randomizing so refresh shows the same question;
  // Day 09 will persist this concrete direction with that first answer.
  return cardIndex % 2 === 0 ? "en_to_vi" : "vi_to_en";
}

export function getFirstUnrememberedCardId(
  cards: StudySessionCard[],
): number | null {
  return cards.find((card) => !card.remembered)?.id ?? null;
}

export function getNextUnrememberedCardId(
  cards: StudySessionCard[],
  currentCardId: number,
): number | null {
  const currentIndex = cards.findIndex((card) => card.id === currentCardId);
  const cardsAfterCurrent = cards.slice(currentIndex + 1);
  const nextCard = cardsAfterCurrent.find((card) => !card.remembered)
    ?? cards.find((card) => !card.remembered);

  return nextCard?.id ?? null;
}

export function countRememberedCards(cards: StudySessionCard[]): number {
  return cards.filter((card) => card.remembered).length;
}
