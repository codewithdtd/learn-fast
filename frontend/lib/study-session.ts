import type {
  StudyAnswerDirection,
  StudyDirection,
  StudySessionCard,
  StudySessionRoundCard,
} from "@/services/api";

export function getCardStudyDirection(
  sessionDirection: StudyDirection,
  sessionCard: StudySessionCard,
  cardIndex: number,
): StudyAnswerDirection {
  if (sessionCard.direction && sessionCard.direction !== "mixed") return sessionCard.direction;
  if (sessionDirection !== "mixed") return sessionDirection;

  // The first answer persists this concrete direction on the server. Alternating
  // by fixed queue position makes the initial mixed prompt stable on refresh.
  return cardIndex % 2 === 0 ? "en_to_vi" : "vi_to_en";
}

export function getInitialRoundCardIndex(cards: StudySessionRoundCard[]): number {
  const firstUnanswered = cards.findIndex((card) => card.result === null);
  return firstUnanswered >= 0 ? firstUnanswered : 0;
}

export function getNextUnansweredRoundCardIndex(
  cards: StudySessionRoundCard[],
  currentIndex: number,
): number {
  const afterCurrent = cards.findIndex(
    (card, index) => index > currentIndex && card.result === null,
  );
  if (afterCurrent >= 0) return afterCurrent;
  // This is automatic progress, not user navigation. Returning to an earlier
  // unanswered card prevents an answer made out of order from being skipped.
  return cards.findIndex((card) => card.result === null);
}

export function countRoundAnswers(cards: StudySessionRoundCard[]) {
  const remembered = cards.filter((card) => card.result === "remembered").length;
  const again = cards.filter((card) => card.result === "again").length;
  return { remembered, again, answered: remembered + again, unanswered: cards.length - remembered - again };
}
