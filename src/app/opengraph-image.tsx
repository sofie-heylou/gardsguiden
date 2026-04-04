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

      {/* App name */}
      <div
        style={{
          fontSize: 104,
          fontWeight: 700,
          color: "#1c1917",
          letterSpacing: -3,
          lineHeight: 1,
          marginBottom: 32,
        }}
      >
        Gårdsguiden
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
