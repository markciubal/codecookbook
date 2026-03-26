import PathfindingVisualizer from "@/components/PathfindingVisualizer";

export const metadata = { title: "Path Finding – CodeCookbook" };

export default function PathfindingPage() {
  return (
    <div className="flex flex-col h-full overflow-auto px-5 py-6">
      <PathfindingVisualizer />
    </div>
  );
}
