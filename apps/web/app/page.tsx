"use client";
import dynamic from "next/dynamic";

const Editor = dynamic(() => import("./editor"), { ssr: false });

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "48px 24px",
        background:
          "radial-gradient(circle at top, rgba(38, 84, 124, 0.18), transparent 45%), #09111a",
        color: "#f4f7fb",
      }}
    >
      <section style={{ maxWidth: 960, margin: "0 auto" }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#8ec5ff",
          }}
        >
          zod-monaco
        </p>
        <h1 style={{ margin: "12px 0 8px", fontSize: 36, lineHeight: 1.1 }}>
          JSON Editor with Zod v4 Validation
        </h1>
        <p
          style={{
            margin: "0 0 28px",
            maxWidth: 680,
            fontSize: 16,
            lineHeight: 1.6,
            color: "rgba(244, 247, 251, 0.65)",
          }}
        >
          Edit the JSON below. The editor validates against a Zod schema in
          real-time — try changing a field to an invalid value.
        </p>
        <Editor />
      </section>
    </main>
  );
}
