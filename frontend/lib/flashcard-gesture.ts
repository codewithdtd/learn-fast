import type { StudyAnswerResult } from "@/services/api";

/**
 * Cấu hình tham số vật lý cho cử chỉ vuốt thẻ (Swipe gesture physics)
 */
export const SWIPE_INTENT_THRESHOLD = 8; // Ngưỡng nhận diện cử chỉ ngang (px)
export const SWIPE_DIRECTION_RATIO = 1.15; // Tỉ lệ dịch chuyển ngang so với dọc để khoá cử chỉ
export const SWIPE_COMMIT_THRESHOLD = 70; // Khoảng cách tối thiểu để xác nhận quẹt thành công (px)
export const DAMPING_LIMIT = 150; // Giới hạn trước khi bắt đầu áp dụng giảm chấn đàn hồi (px)
export const DAMPING_FACTOR = 0.35; // Hệ số giảm chấn khi kéo quá DAMPING_LIMIT
export const MAX_ROTATION_DEG = 12; // Góc xoay tối đa khi quẹt (độ)
export const PREVIEW_START_PX = 15; // Khoảng cách bắt đầu hiện nhãn gợi ý (px)
export const PREVIEW_FULL_PX = 65; // Khoảng cách nhãn đạt 100% độ rõ (px)

export type SwipeDragCalculation = {
  isIntent: boolean;
  offset: number;
  rotation: number;
  previewProgress: number;
  resultType: StudyAnswerResult;
  isCommitted: boolean;
};

/**
 * Tính toán độ dời, góc nghiêng tự nhiên và trạng thái quẹt từ khoảng cách di chuyển
 * Áp dụng giảm chấn đàn hồi (elastic damping) để cử chỉ kéo trên mobile mượt mà, không bị khựng cứng.
 */
export function computeSwipeDrag(deltaX: number, deltaY: number): SwipeDragCalculation {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  // Nhận diện ý định vuốt ngang khi dịch chuyển trục X vượt trội so với trục Y
  const isIntent = absX > SWIPE_INTENT_THRESHOLD && absX > absY * SWIPE_DIRECTION_RATIO;

  // Tính độ dời có giảm chấn đàn hồi khi kéo vượt DAMPING_LIMIT
  let offset = deltaX;
  if (absX > DAMPING_LIMIT) {
    const excess = absX - DAMPING_LIMIT;
    offset = Math.sign(deltaX) * (DAMPING_LIMIT + excess * DAMPING_FACTOR);
  }

  // Góc xoay thẻ tỉ lệ thuận với khoảng cách kéo tạo cảm giác thẻ bài vật lý nghiêng tự nhiên
  const rotation = Math.max(-MAX_ROTATION_DEG, Math.min(MAX_ROTATION_DEG, offset * 0.055));

  // Độ rõ (opacity) và tỉ lệ hiển thị của nhãn Stamp ("Forgot" hoặc "Remembered")
  const absOffset = Math.abs(offset);
  const previewProgress = Math.min(
    1,
    Math.max(0, (absOffset - PREVIEW_START_PX) / (PREVIEW_FULL_PX - PREVIEW_START_PX)),
  );

  // Kéo sang trái (< 0) tương ứng với "Again" (chưa thuộc), kéo sang phải (> 0) tương ứng với "Remembered" (đã nhớ)
  const resultType: StudyAnswerResult = offset < 0 ? "again" : "remembered";

  // Xác nhận quẹt thành công khi độ dời thực tế vượt ngưỡng cam kết
  const isCommitted = absOffset >= SWIPE_COMMIT_THRESHOLD;

  return {
    isIntent,
    offset,
    rotation,
    previewProgress,
    resultType,
    isCommitted,
  };
}
