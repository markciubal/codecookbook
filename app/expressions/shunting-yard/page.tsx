import ExpressionVisualizer from "@/components/ExpressionVisualizer";

export const metadata = { title: "Shunting Yard – CodeCookbook" };

export default function Page() {
  return <ExpressionVisualizer algorithm="shunting-yard" />;
}
