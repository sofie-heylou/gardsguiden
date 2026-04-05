import { ImageResponse } from "next/og";

export const alt = "Gårdsguiden — Hitta gårdsbutiker nära dig";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        padding: "72px 80px",
        background: "#FAFAF8",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
      }}
    >
      {/* Amber accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 6,
          background: "#f59e0b",
        }}
      />

      {/* Icon + App name */}
      <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 32 }}>
        {/* Flower icon — petals as explicit paths (satori doesn't support SVG <use>) */}
        <svg width="96" height="96" viewBox="0 0 100 100">
          <path d="M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z" fill="#1c1917" />
          <path d="M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z" fill="#1c1917" transform="rotate(45 50 50)" />
          <path d="M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z" fill="#1c1917" transform="rotate(90 50 50)" />
          <path d="M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z" fill="#1c1917" transform="rotate(135 50 50)" />
          <path d="M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z" fill="#1c1917" transform="rotate(180 50 50)" />
          <path d="M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z" fill="#1c1917" transform="rotate(225 50 50)" />
          <path d="M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z" fill="#1c1917" transform="rotate(270 50 50)" />
          <path d="M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z" fill="#1c1917" transform="rotate(315 50 50)" />
        </svg>
        <div
          style={{
            fontSize: 104,
            fontWeight: 700,
            color: "#1c1917",
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          Gårdsguiden
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 38,
          color: "#44403c",
          fontWeight: 400,
          lineHeight: 1,
          marginBottom: 20,
        }}
      >
        Hitta gårdsbutiker nära dig
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 26,
          color: "#a8a29e",
          fontWeight: 400,
        }}
      >
        161 gårdar med lokalproducerad mat
      </div>

      {/* Bottom domain badge */}
      <div
        style={{
          position: "absolute",
          bottom: 72,
          right: 80,
          fontSize: 22,
          color: "#a8a29e",
          letterSpacing: 0.5,
        }}
      >
        gardsguiden.se
      </div>
    </div>,
    size
  );
}
