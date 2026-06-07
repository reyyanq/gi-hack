import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: PlaceholderPage,
});

function PlaceholderPage() {
  return (
    <div style={{ padding: "32px 36px", color: "#fff" }}>
      <h1>Landing page coming soon...</h1>
    </div>
  );
}
