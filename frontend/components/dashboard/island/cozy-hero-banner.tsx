"use client";

import { useEffect, useState } from "react";
import styles from "./cozy-dashboard.module.css";

interface CozyHeroBannerProps {
  userName: string;
}

export function CozyHeroBanner({ userName }: CozyHeroBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [avatarError, setAvatarError] = useState(false);
  const [currentSeason, setCurrentSeason] = useState<{ name: string; icon: string }>({
    name: "Spring",
    icon: "🌱",
  });

  useEffect(() => {
    setMounted(true);
    const now = new Date();

    // Định dạng giờ: "HH:mm"
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setCurrentTime(`${hours}:${minutes}`);

    // Định dạng ngày tháng: "31 Oct 2026"
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    setCurrentDate(`${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);

    // Tính mùa dựa theo tháng thực tế (Bán cầu Bắc)
    // Tháng 3-5: Xuân, Tháng 6-8: Hạ, Tháng 9-11: Thu, Tháng 12-2: Đông
    const m = now.getMonth() + 1;
    if (m >= 3 && m <= 5) setCurrentSeason({ name: "Spring", icon: "🌱" });
    else if (m >= 6 && m <= 8) setCurrentSeason({ name: "Summer", icon: "☀️" });
    else if (m >= 9 && m <= 11) setCurrentSeason({ name: "Autumn", icon: "🍂" });
    else setCurrentSeason({ name: "Winter", icon: "❄️" });

    // Cập nhật đồng hồ mỗi 30 giây
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const initial = userName.trim() ? userName.trim().charAt(0).toUpperCase() : "L";

  return (
    <section className={styles.heroBanner} aria-label="Learning Sanctuary Header">
      {/* Cảnh phong cảnh thiên nhiên màu nước Cozy Island Banner */}
      <div className={styles.heroArtWrap} aria-hidden="true">
        <img
          src="/banner.jpg"
          alt=""
          className={styles.heroArtImage}
          loading="eager"
        />
      </div>

      {/* Thông tin Lời chào & Widget Trạng thái Đảo */}
      <div className={styles.heroInfoRow}>
        <div className={styles.heroGreeting}>
          <div className={styles.heroGreetingIcon} aria-hidden="true">
            🌲
          </div>
          <div className={styles.heroGreetingText}>
            <h1>
              Welcome back, {userName}! 🍃
            </h1>
            <p>Here is today&apos;s overview of your English learning sanctuary.</p>
          </div>
        </div>

        {/* Widget Thời gian, Mùa & Trạng thái Đảo thực tế */}
        <div className={styles.islandStatusWidget} aria-label="Current date and time">
          <div className={styles.statusItem} title="Current Date">
            <span aria-hidden="true">📅</span>
            <span>{mounted ? currentDate : "Today"}</span>
          </div>

          <div className={styles.statusDivider} aria-hidden="true" />

          <div className={styles.statusItem} title="Current Season">
            <span aria-hidden="true">{mounted ? currentSeason.icon : "🌱"}</span>
            <span>{mounted ? currentSeason.name : "Season"}</span>
          </div>

          <div className={styles.statusDivider} aria-hidden="true" />

          <div className={styles.statusItem} title="Local Time">
            <span aria-hidden="true">⏰</span>
            <span>{mounted ? currentTime : "--:--"}</span>
          </div>

          {/* Avatar học viên với hình vẽ đáng yêu */}
          <div className={styles.statusAvatar} aria-label={`Learner ${userName}`}>
            <img
              src="/avatar.jpg"
              alt={userName}
              className={styles.statusAvatarImg}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
