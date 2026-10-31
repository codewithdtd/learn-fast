"use client";

import type { DashboardSummary } from "@/services/api";
import { CozyHeroBanner } from "./cozy-hero-banner";
import { CozyOverviewWidget } from "./widgets/cozy-overview-widget";
import { CozyQuestsWidget } from "./widgets/cozy-quests-widget";
import { CozyDailyPracticeWidget } from "./widgets/cozy-daily-practice-widget";
import { CozyAISkillsWidget } from "./widgets/cozy-ai-skills-widget";
import { CozyReviewQueueWidget } from "./widgets/cozy-review-queue-widget";
import { CozyMemosWidget } from "./widgets/cozy-memos-widget";
import styles from "./cozy-dashboard.module.css";

interface CozyDashboardViewProps {
  dashboard: DashboardSummary;
  streak: number;
  userName: string;
}

export function CozyDashboardView({ dashboard, streak, userName }: CozyDashboardViewProps) {
  return (
    <div className={styles.islandRoot} data-theme-island-active="true">
      {/* 1. Hero Landscape Banner & Status Widget */}
      <CozyHeroBanner userName={userName} />

      {/* 2. Top Row (3 Columns on Desktop): Overview, Quests, Daily Focus */}
      <div className={styles.gridRow3}>
        <CozyOverviewWidget dashboard={dashboard} streak={streak} />
        <CozyQuestsWidget dashboard={dashboard} streak={streak} />
        <CozyDailyPracticeWidget dashboard={dashboard} />
      </div>

      {/* 3. Middle Row (2 Columns on Desktop): AI Skill Workshop & Learning Queues */}
      <div className={styles.gridRow2}>
        <CozyAISkillsWidget />
        <CozyReviewQueueWidget dashboard={dashboard} />
      </div>

      {/* 4. Bottom Row: Corkboard Sticky Notes */}
      <CozyMemosWidget />
    </div>
  );
}

