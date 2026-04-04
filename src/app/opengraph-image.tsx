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

      {/* County tags */}
      <div style={{ display: "flex", gap: 10, marginBottom: 44 }}>
        {["Stockholm", "Uppsala", "Västmanland", "Södermanland"].map((lan) => (
          <div
            key={lan}
            style={{
              padding: "6px 18px",
              borderRadius: 999,
              background: "#f5f5f4",
              border: "1px solid #e7e5e4",
              color: "#78716c",
              fontSize: 22,
              letterSpacing: 0.2,
            }}
          >
            {lan}
          </div>
        ))}
      </div>

      {/* App name */}
      <div
        style={{
          fontSize: 100,
          fontWeight: 700,
          color: "#1c1917",
          letterSpacing: -3,
          lineHeight: 1,
          marginBottom: 28,
        }}
      >
        Gårdsguiden
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 32,
          color: "#78716c",
          fontWeight: 400,
          lineHeight: 1.45,
          maxWidth: 720,
        }}
      >
        161 gårdsbutiker i Mälardalen — köp lokalt direkt från bonden.
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
