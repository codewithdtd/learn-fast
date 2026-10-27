import styles from "./paragraph-practice.module.css";

type VietnamesePassageProps = {
  text: string;
  style: "paragraph" | "dialogue";
};

export function VietnamesePassage({ text, style }: VietnamesePassageProps) {
  if (style === "paragraph") {
    return <p className={styles.passage} lang="vi">{text}</p>;
  }

  const messages = text.split(/\r?\n/).map((line) => {
    const match = line.trim().match(/^([AB]):\s*(.+)$/);
    return match ? { speaker: match[1], text: match[2] } : null;
  }).filter((message): message is { speaker: string; text: string } => message !== null);

  if (messages.length === 0) {
    return <p className={styles.passage} lang="vi">{text}</p>;
  }

  return (
    <ol className={styles.dialogue} aria-label="Vietnamese conversation transcript">
      {messages.map((message, index) => (
        <li className={styles.dialogueMessage} data-speaker={message.speaker} key={`${index}-${message.speaker}`}>
          <span className={styles.speakerAvatar} aria-hidden="true">{message.speaker}</span>
          <div className={styles.messageBubble}>
            <span className={styles.speakerLabel}>Speaker {message.speaker}</span>
            <p lang="vi">{message.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
