import Link from "next/link";
import { TOPICS } from "@/lib/learning/types";
import { QUESTION_BANK } from "@/lib/learning/bank";
import { GraduationCap } from "lucide-react";

export const metadata = { title: "Learning – CodeCookbook" };

export default function LearningIndex() {
  // Count questions per topic
  const counts = QUESTION_BANK.reduce<Record<string, number>>((acc, q) => {
    acc[q.topic] = (acc[q.topic] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <GraduationCap size={22} style={{ color: "var(--color-accent)" }} strokeWidth={1.75} />
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Learning</h1>
      </div>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 28, lineHeight: 1.5 }}>
        Interactive lessons with multiple choice, fill-in-the-blank, ordering, matching, and more.
        Each topic shuffles questions and tracks your score.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 14,
      }}>
        {TOPICS.map(topic => {
          const count = counts[topic.id] ?? 0;
          const disabled = count === 0;
          return (
            <Link
              key={topic.id}
              href={disabled ? "#" : `/learning/${topic.id}`}
              style={{
                pointerEvents: disabled ? "none" : "auto",
                textDecoration: "none",
                display: "block",
                padding: 16,
                borderRadius: 8,
                background: "var(--color-surface-1)",
                border: "1px solid var(--color-border)",
                opacity: disabled ? 0.4 : 1,
                transition: "border-color 0.2s, background 0.2s",
              }}
              className="learning-card"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", flex: 1 }}>
                  {topic.name}
                </span>
                <span style={{
                  fontSize: 10, fontFamily: "monospace",
                  padding: "2px 6px", borderRadius: 3,
                  background: count > 0 ? "var(--color-accent-muted)" : "var(--color-surface-3)",
                  color: count > 0 ? "var(--color-accent)" : "var(--color-muted)",
                  border: `1px solid ${count > 0 ? "var(--color-accent)" : "var(--color-border)"}`,
                }}>
                  {count} {count === 1 ? "question" : "questions"}
                </span>
              </div>
              <p style={{
                fontSize: 11, color: "var(--color-muted)",
                lineHeight: 1.4, margin: 0,
              }}>
                {topic.blurb}
              </p>
            </Link>
          );
        })}
      </div>

      <style>{`
        .learning-card:hover {
          border-color: var(--color-accent) !important;
          background: var(--color-surface-2) !important;
        }
      `}</style>
    </div>
  );
}
