import { notFound } from "next/navigation";
import Link from "next/link";
import { TOPICS, type Topic } from "@/lib/learning/types";
import { QUESTION_BANK } from "@/lib/learning/bank";
import Lesson from "@/components/Lesson";
import { ChevronLeft } from "lucide-react";

export async function generateStaticParams() {
  return TOPICS.map(t => ({ topic: t.id }));
}

export default async function TopicLessonPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  const meta = TOPICS.find(t => t.id === topic);
  if (!meta) notFound();

  const questions = QUESTION_BANK.filter(q => q.topic === (topic as Topic));
  if (questions.length === 0) notFound();

  return (
    <div style={{ padding: "24px 28px", maxWidth: 800, margin: "0 auto" }}>
      <Link
        href="/learning"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, fontFamily: "monospace",
          color: "var(--color-muted)", textDecoration: "none",
          marginBottom: 16,
        }}
      >
        <ChevronLeft size={12} /> All topics
      </Link>
      <Lesson questions={questions} topicName={meta.name} />
    </div>
  );
}
