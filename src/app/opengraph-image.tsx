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
        background: "linear-gradient(150deg, #1c1917 0%, #292524 40%, #1a2e1a 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
      }}
    >
      {/* Decorative circles */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "rgba(34, 85, 34, 0.25)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 180,
          width: 220,
          height: 220,
          borderRadius: "50%",
          background: "rgba(34, 85, 34, 0.15)",
        }}
      />

      {/* County tags */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 40,
        }}
      >
        {["Stockholm", "Uppsala", "Västmanland", "Södermanland"].map((lan) => (
          <div
            key={lan}
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#d6d3d1",
              fontSize: 22,
              letterSpacing: 0.3,
            }}
          >
            {lan}
          </div>
        ))}
      </div>

      {/* App name */}
      <div
        style={{
          fontSize: 96,
          fontWeight: 700,
          color: "#fef3c7",
          letterSpacing: -2,
          lineHeight: 1,
          marginBottom: 24,
        }}
      >
        Gårdsguiden
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 34,
          color: "#a8a29e",
          fontWeight: 400,
          lineHeight: 1.4,
          maxWidth: 700,
        }}
      >
        Hitta gårdsbutiker och lokala råvaror direkt från bonden — i Stockholm, Uppsala, Västmanland och Södermanland.
      </div>

      {/* Bottom domain badge */}
      <div
        style={{
          position: "absolute",
          bottom: 72,
          right: 80,
          fontSize: 24,
          color: "rgba(255,255,255,0.3)",
          letterSpacing: 0.5,
        }}
      >
        gardsguiden.se
      </div>
    </div>,
    size
  );
}
