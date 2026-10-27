import Link from "next/link";

import { LearningIllustration } from "@/components/illustrations/learning-illustration";
import { NoriMascot } from "@/components/illustrations/nori-mascot";
import { Icon } from "@/components/layout/app-shell";
import type { DashboardSummary } from "@/services/api";

type JourneyDashboardProps = {
  userName: string;
  streak: number;
  dashboard: DashboardSummary;
};

export function JourneyDashboard({ userName, streak, dashboard }: JourneyDashboardProps) {
  return (
    <div className="journey-only journey-dashboard">
      <header className="journey-welcome" aria-labelledby="journey-welcome-title">
        <NoriMascot pose="welcome" size={68} className="journey-welcome-art" />
        <div className="journey-welcome-copy">
          <p className="journey-welcome-kicker">TODAY</p>
          <h1 id="journey-welcome-title">Hi, {userName}</h1>
          <p>{getTodaySummary(dashboard)}</p>
        </div>
        <Link href="/calendar" className="journey-streak" aria-label={`${streak} day learning streak. View calendar.`}>
          <Icon name="flame" size={17} /><strong>{streak}</strong><span>day streak</span>
        </Link>
      </header>

    </div>
  );
}

export function JourneyExplore() {
  return (
    <section className="journey-only journey-explore-section" aria-labelledby="journey-explore-title">
      <div className="journey-section-heading">
        <div><p className="journey-welcome-kicker">KEEP BUILDING</p><h2 id="journey-explore-title">Practice a skill</h2></div>
      </div>
      <div className="journey-explore">
        <Link href="/ai-support?tab=sentences" className="journey-explore-link" data-tone="blue"><span className="journey-explore-icon"><LearningIllustration kind="writing" /></span><span className="journey-explore-copy"><strong>Make a sentence</strong><span>Use a word you are learning</span></span><Icon name="arrow" size={18} /></Link>
        <Link href="/ai-support?tab=speaking" className="journey-explore-link" data-tone="teal"><span className="journey-explore-icon"><LearningIllustration kind="speaking" /></span><span className="journey-explore-copy"><strong>Speaking practice</strong><span>Answer one short question</span></span><Icon name="arrow" size={18} /></Link>
        <Link href="/ai-support?tab=video" className="journey-explore-link" data-tone="violet"><span className="journey-explore-icon"><LearningIllustration kind="video" /></span><span className="journey-explore-copy"><strong>Shadow a video</strong><span>Listen and repeat a line</span></span><Icon name="arrow" size={18} /></Link>
        <Link href="/reading" className="journey-explore-link" data-tone="gold"><span className="journey-explore-icon"><Icon name="books" size={22} /></span><span className="journey-explore-copy"><strong>Read the news</strong><span>Build vocabulary from real articles</span></span><Icon name="arrow" size={18} /></Link>
      </div>
    </section>
  );
}

function getTodaySummary(dashboard: DashboardSummary) {
  // Match the dashboard action's active -> due -> new priority so its greeting never implies a different next step.
  if (dashboard.active_sessions.length > 0) return "Pick up where you left off.";
  if (dashboard.due_sheets.length > 0) return `${dashboard.due_sheets.length} sheet${dashboard.due_sheets.length === 1 ? "" : "s"} ready for review.`;
  if (dashboard.new_sheets.length > 0) return "A fresh set of words is ready.";
  return "Choose a workbook and learn at your pace.";
}
