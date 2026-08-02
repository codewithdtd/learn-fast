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

export function buildMasteryQueue(
  cards: StudySessionCard[],
  sessionId: number,
): number[] {
  const queue = cards.filter((card) => !card.remembered).map((card) => card.id);
  let state = hashNumber(String(sessionId));

  for (let index = queue.length - 1; index > 0; index -= 1) {
    state = nextPseudoRandomState(state);
    const swapIndex = state % (index + 1);
    [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
  }

  return queue;
}

export function getRetryGap(
  sessionId: number,
  sessionCardId: number,
  nextAgainCount: number,
): number {
  return 4 + (hashNumber(`${sessionId}:${sessionCardId}:${nextAgainCount}`) % 4);
}

export function advanceMasteryQueue(
  queue: number[],
  result: "again" | "remembered",
  retryGap = 4,
): number[] {
  const [currentCardId, ...remainingCardIds] = queue;
  if (currentCardId === undefined || result === "remembered") {
    return remainingCardIds;
  }

  // The current card is removed before insertion, so it can never exist twice
  // in the queue. A short queue puts it after all available other cards.
  const retryIndex = Math.min(remainingCardIds.length, retryGap);
  return [
    ...remainingCardIds.slice(0, retryIndex),
    currentCardId,
    ...remainingCardIds.slice(retryIndex),
  ];
}

function hashNumber(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextPseudoRandomState(state: number): number {
  let next = state + 0x6d2b79f5;
  next = Math.imul(next ^ (next >>> 15), next | 1);
  next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
  return (next ^ (next >>> 14)) >>> 0;
}
