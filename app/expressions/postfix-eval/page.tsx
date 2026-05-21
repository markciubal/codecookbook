"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ExpressionVisualizer from "@/components/ExpressionVisualizer";

// Tiny wrapper that lets the page accept `?expr=...` so the Shunting Yard
// page can hand the user's postfix output straight into the evaluator.
function PostfixEvalPageInner() {
  const params = useSearchParams();
  const expr = params.get("expr");
  return <ExpressionVisualizer algorithm="postfix-eval" initialInput={expr ?? undefined} />;
}

export default function Page() {
  return (
    <Suspense>
      <PostfixEvalPageInner />
    </Suspense>
  );
}
