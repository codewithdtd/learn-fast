"use client";

import Link from "next/link";
import styles from "../cozy-dashboard.module.css";

export function CozyAISkillsWidget() {
  const skills = [
    {
      id: "sentences",
      title: "Make a sentence",
      desc: "Use words in natural sentences with instant AI feedback",
      icon: "✍️",
      href: "/ai-support?tab=sentences",
    },
    {
      id: "speaking",
      title: "Speaking practice",
      desc: "Voice answers to daily speaking topics with AI guidance",
      icon: "🎙️",
      href: "/ai-support?tab=speaking",
    },
    {
      id: "video",
      title: "Shadow a video",
      desc: "Listen and shadow real YouTube English dialogue",
      icon: "🎬",
      href: "/ai-support?tab=video",
    },
    {
      id: "news",
      title: "Read English news",
      desc: "Expand vocabulary from bilingual news and articles",
      icon: "📰",
      href: "/reading",
    },
  ];

  return (
    <article className={styles.cozyCard} aria-labelledby="cozy-skills-title">
      <header className={styles.cardHeader}>
        <div className={styles.cardHeaderTitle}>
          <span className={styles.cardHeaderIcon} aria-hidden="true">🛠️</span>
          <h2 id="cozy-skills-title" className={styles.cardTitle}>Skill Workshop</h2>
        </div>
        <Link href="/ai-support" className={styles.cardActionLink} aria-label="Explore all AI learning features">
          AI Hub <span>→</span>
        </Link>
      </header>

      <div className={styles.aiSkillsGrid}>
        {skills.map((skill) => (
          <Link
            key={skill.id}
            href={skill.href}
            className={styles.aiSkillTile}
            aria-label={`${skill.title}: ${skill.desc}`}
          >
            <div className={styles.aiSkillIconWrap} aria-hidden="true">
              {skill.icon}
            </div>
            <div className={styles.aiSkillInfo}>
              <strong>{skill.title}</strong>
              <span>{skill.desc}</span>
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}

