import { ImageResponse } from "next/og";

export const alt = "NodeTasks — Node.js process monitor for Windows";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #0f0f11 0%, #14141a 60%, #0b1a2e 100%)",
          color: "#e8e8ea",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 22 }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 18,
              background: "#4da6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              fontWeight: 900,
              color: "#04121f",
              letterSpacing: "-2px",
            }}
          >
            N
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-1px" }}>
            NodeTasks
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 76,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-2px",
            }}
          >
            <div>Monitor every Node.js</div>
            <div>process on your machine.</div>
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#9a9aa5",
              marginTop: 28,
              letterSpacing: "-0.3px",
            }}
          >
            A tiny native Windows app · ~2 MB · One-click Kill All
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#6a6a72",
          }}
        >
          <span>nodetasks.com</span>
          <span style={{ color: "#4da6ff" }}>Download free for Windows →</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
