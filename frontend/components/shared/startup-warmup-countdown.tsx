"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./startup-warmup-countdown.module.css";
import { pingBackendHealth } from "@/services/api";

export type StartupWarmupProps = {
  /** Thời gian đếm ngược ước tính ban đầu (mặc định: 45 giây cho Render free tier cold start) */
  initialSeconds?: number;
  /** Callback được kích hoạt ngay khi máy chủ phản hồi sẵn sàng */
  onReady?: () => void;
  /** Ngữ cảnh sử dụng: "auth" (chờ xác thực token) | "dashboard" (chờ nạp dữ liệu chính) | "general" */
  context?: "auth" | "dashboard" | "general";
  /** Ẩn header để tích hợp gọn trong các widget */
  compact?: boolean;
};

type EnglishTip = {
  tag: string;
  phrase: string;
  meaning: string;
  example: string;
};

// Bộ sưu tập mẹo học và thành ngữ tiếng Anh ngắn gọn, hữu ích để người học đọc giải trí trong 30-50s
const ENGLISH_TIPS: EnglishTip[] = [
  {
    tag: "Thành ngữ thông dụng",
    phrase: "Hit the ground running",
    meaning: "Bắt đầu một việc gì đó với toàn bộ nhiệt huyết, năng lượng và tốc độ tối đa.",
    example: '“I\'m ready to hit the ground running with 20 new vocabulary cards today!”',
  },
  {
    tag: "Bí quyết Spaced Repetition",
    phrase: "Quy luật lặp lại ngắt quãng",
    meaning: "Ôn tập từ vựng ngay tại thời điểm chuẩn bị quên giúp kích thích tế bào thần kinh, tăng độ ghi nhớ sâu gấp 3 lần so với học dồn.",
    example: "Hệ thống Learn-Fast tự động tính toán khoảng cách ngày tối ưu cho từng từ của bạn.",
  },
  {
    tag: "Thành ngữ thông dụng",
    phrase: "Burn the midnight oil",
    meaning: "Thức khuya chăm chỉ học bài hoặc nghiên cứu một đề tài khó.",
    example: '“She burned the midnight oil preparing for the speaking assessment.”',
  },
  {
    tag: "Bí quyết học từ vựng",
    phrase: "Học từ theo ngữ cảnh (Collocations)",
    meaning: "Đừng ghi nhớ các từ đơn lẻ độc lập! Luôn gắn từ mới với 1 động từ đi kèm hoặc cụm câu thực tế trong đời sống.",
    example: "Thay vì chỉ học 'decision', hãy học cụm 'make a crucial decision'.",
  },
  {
    tag: "Thành ngữ thông dụng",
    phrase: "A piece of cake",
    meaning: "Việc gì đó cực kỳ dễ dàng, không tốn nhiều công sức để hoàn thành.",
    example: '“Once you understand the root word, guessing new meanings is a piece of cake.”',
  },
  {
    tag: "Thói quen học tập",
    phrase: "Nguyên tắc 10 phút vàng",
    meaning: "Luyện 10 phút Flashcard đều đặn mỗi sáng hiệu quả vượt trội so với việc học dồn 2 tiếng vào cuối tuần.",
    example: "Duy trì chuỗi Streak mỗi ngày giúp não bộ hình thành phản xạ ngôn ngữ tự nhiên.",
  },
  {
    tag: "Thành ngữ thông dụng",
    phrase: "Learn the ropes",
    meaning: "Học hỏi và nắm bắt các kỹ năng hoặc quy trình cơ bản của một lĩnh vực mới.",
    example: '“It only takes a couple of days to learn the ropes of this SRS flashcard app.”',
  },
  {
    tag: "Bí quyết phát âm",
    phrase: "Phương pháp Shadowing (Nói đuổi)",
    meaning: "Đọc to từ vựng và nhại lại giọng người bản xứ theo thời gian thực để cơ hàm và tai cùng quen với nhịp điệu tiếng Anh.",
    example: "Tính năng Video Practice và AI Speaking trong app giúp bạn luyện Shadowing tiện lợi.",
  },
];

export function StartupWarmupCountdown({
  initialSeconds = 45,
  onReady,
  context = "general",
  compact = false,
}: StartupWarmupProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(initialSeconds);
  const [isAwake, setIsAwake] = useState<boolean>(false);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [tipIndex, setTipIndex] = useState<number>(0);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // 1. Quản lý đồng hồ đếm ngược từng giây
  useEffect(() => {
    if (isAwake) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAwake]);

  // 2. Tự động xoay tua các mẹo học tiếng Anh mỗi 6 giây để chống nhàm chán
  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ENGLISH_TIPS.length);
    }, 6000);
    return () => clearInterval(tipTimer);
  }, []);

  // 3. Hàm thăm dò sức khỏe backend (health probe)
  const probeServer = useCallback(async () => {
    setIsPinging(true);
    try {
      const ok = await pingBackendHealth(3500);
      if (ok) {
        setIsAwake(true);
        // Chờ 600ms hiệu ứng thành công trước khi gọi callback chuyển tiếp
        setTimeout(() => {
          if (onReadyRef.current) {
            onReadyRef.current();
          }
        }, 650);
      }
    } finally {
      setIsPinging(false);
    }
  }, []);

  // 4. Polling liên tục mỗi 2.8 giây để phát hiện ngay lập tức khi máy chủ Render vừa thức
  useEffect(() => {
    if (isAwake) return;
    // Bắt đầu probe ngay sau 800ms
    const initialProbe = setTimeout(() => {
      void probeServer();
    }, 800);

    const interval = setInterval(() => {
      void probeServer();
    }, 2800);

    return () => {
      clearTimeout(initialProbe);
      clearInterval(interval);
    };
  }, [isAwake, probeServer]);

  // Tính toán tỷ lệ hoàn thành thanh tiến trình (Progress Bar)
  const progressPercent = isAwake
    ? 100
    : Math.min(95, Math.max(5, Math.round(((initialSeconds - secondsLeft) / initialSeconds) * 100)));

  // Lấy thông điệp tiến trình tương ứng với mốc thời gian
  const getStageMessage = () => {
    if (isAwake) return "✨ Máy chủ đã sẵn sàng! Đang vào ứng dụng...";
    const elapsed = initialSeconds - secondsLeft;
    if (elapsed < 8) return "☕ Đang gửi tín hiệu kích hoạt máy chủ Render...";
    if (elapsed < 20) return "🍃 Khởi động dịch vụ FastAPI & kết nối PostgreSQL...";
    if (elapsed < 32) return "📦 Nạp cơ sở dữ liệu từ vựng & cấu hình thuật toán SRS...";
    if (elapsed < 42) return "🌱 Chuẩn bị bảng điều khiển học tập cá nhân cho bạn...";
    return "🚀 Giai đoạn cuối: Đang hoàn tất kết nối, sẵn sàng trong giây lát...";
  };

  const currentTip = ENGLISH_TIPS[tipIndex];

  const handleNextTip = () => {
    setTipIndex((prev) => (prev + 1) % ENGLISH_TIPS.length);
  };

  const handlePrevTip = () => {
    setTipIndex((prev) => (prev - 1 + ENGLISH_TIPS.length) % ENGLISH_TIPS.length);
  };

  return (
    <aside className={styles.warmupContainer} aria-live="polite" aria-busy={!isAwake}>
      <div className={styles.card}>
        {/* Header với biểu tượng ấm áp phong cách Cozy Island */}
        {!compact && (
          <header className={styles.headerWrap}>
            <div className={styles.mascotBadge} aria-hidden="true">
              {isAwake ? "🎉" : "☕"}
            </div>
            <h2 className={styles.title}>
              {isAwake ? "Máy chủ đã sẵn sàng!" : "Đang đánh thức máy chủ học tập"}
            </h2>
            <p className={styles.subtitle}>
              {isAwake
                ? "Dữ liệu học tập đã được đồng bộ, chúc bạn có một buổi học hiệu quả!"
                : context === "auth"
                ? "Máy chủ đang khởi động lại từ chế độ ngủ miễn phí của Render để xác thực tài khoản."
                : "Backend Render miễn phí đang khởi động lại (ước tính ~30–45 giây)."}
            </p>
          </header>
        )}

        {/* Khối hiển thị Đồng hồ đếm ngược hoặc Banner thành công */}
        {isAwake ? (
          <div className={styles.readyBanner}>
            <span>🚀</span>
            <span>Kết nối thành công! Đang chuyển tiếp...</span>
          </div>
        ) : (
          <div className={styles.timerWrap}>
            <div className={styles.timerRow}>
              <span className={styles.countdownNumber}>{secondsLeft}</span>
              <span className={styles.countdownUnit}>giây ước tính</span>
            </div>

            {/* Thanh tiến trình sinh động */}
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={styles.progressBar}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Trạng thái kỹ thuật luân chuyển */}
            <div className={styles.stageStatus}>
              <span className={styles.pulsingDot} aria-hidden="true" />
              <span>{getStageMessage()}</span>
            </div>
          </div>
        )}

        {/* Góc Học Nhanh: Giúp người dùng đọc thành ngữ & mẹo học trong khi chờ */}
        <section className={styles.learningCorner} aria-label="Góc học nhanh">
          <div className={styles.cornerHeader}>
            <span className={styles.cornerTag}>
              <span>💡</span>
              <span>{currentTip.tag}</span>
            </span>
            <div className={styles.cornerNav}>
              <button
                type="button"
                className={styles.navButton}
                onClick={handlePrevTip}
                aria-label="Mẹo trước"
                title="Mẹo trước"
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.navButton}
                onClick={handleNextTip}
                aria-label="Mẹo kế tiếp"
                title="Mẹo kế tiếp"
              >
                ›
              </button>
            </div>
          </div>
          <div className={styles.tipContent} key={tipIndex}>
            <p className={styles.tipPhrase}>{currentTip.phrase}</p>
            <p className={styles.tipMeaning}>{currentTip.meaning}</p>
            <p className={styles.tipExample}>{currentTip.example}</p>
          </div>
        </section>

        {/* Nút kiểm tra thủ công & Hộp giải thích Render Free Tier */}
        <footer className={styles.actionsRow}>
          <button
            type="button"
            className={styles.pingButton}
            onClick={() => void probeServer()}
            disabled={isPinging || isAwake}
          >
            {isPinging ? "🔄 Đang kiểm tra..." : "⚡ Thử kết nối ngay"}
          </button>
          <button
            type="button"
            className={styles.infoToggle}
            onClick={() => setShowExplanation((prev) => !prev)}
            aria-expanded={showExplanation}
          >
            {showExplanation ? "Ẩn giải thích" : "Tại sao cần đợi?"}
          </button>
        </footer>

        {showExplanation && (
          <div className={styles.explanationBox}>
            <p>
              <strong>Cơ chế ngủ của Render Free Tier:</strong> Để tiết kiệm tài nguyên máy chủ miễn
              phí, dịch vụ Render sẽ tự động đưa backend vào trạng thái ngủ đông (Sleep) nếu không
              có yêu cầu nào trong 15 phút. Lần truy cập đầu tiên sẽ đánh thức container và khởi
              chạy lại FastAPI + PostgreSQL, thường mất từ 30 đến 50 giây. Sau khi máy chủ đã thức,
              mọi thao tác học tập tiếp theo sẽ phản hồi ngay lập tức trong vài mili-giây!
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
