import fs from "fs";
import path from "path";
import type { ReactElement } from "react";

// ── Flower ───────────────────────────────────────────────────────────────────

// Inlined petals (no <use>/<defs>) for maximum renderer compatibility
const PETAL = "M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z";

const FLOWER_SVG = [
  `<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">`,
  `<path fill="black" d="${PETAL}"/>`,
  ...[45, 90, 135, 180, 225, 270, 315].map(
    (a) => `<path fill="black" d="${PETAL}" transform="rotate(${a} 50 50)"/>`
  ),
  `</svg>`,
].join("");

export const FLOWER_SRC = `data:image/svg+xml;base64,${Buffer.from(FLOWER_SVG).toString("base64")}`;

// ── Fonts ────────────────────────────────────────────────────────────────────

function loadFont(name: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(process.cwd(), "public/fonts", name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export function getFonts() {
  return [
    { name: "Lora", data: loadFont("Lora-Regular.ttf"), style: "normal" as const, weight: 400 as const },
    { name: "Lora", data: loadFont("Lora-Bold.ttf"),    style: "normal" as const, weight: 700 as const },
  ];
}

// ── Shared card template ─────────────────────────────────────────────────────

export interface OgCardProps {
  /** Small label above the title */
  eyebrow?: string;
  /** Main large heading */
  title: string;
  /** Smaller line below the title */
  subtitle?: string;
  flowerSrc: string;
}

export function OgCard({ eyebrow, title, subtitle, flowerSrc }: OgCardProps): ReactElement {
  const titleSize = title.length > 32 ? 48 : title.length > 22 ? 56 : 64;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#FAFAF8",
        padding: "52px 64px 64px",
        position: "relative",
        fontFamily: "Lora",
      }}
    >
      {/* Brand header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={flowerSrc} width={24} height={24} alt="" style={{ display: "block" }} />
        <span
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: "#a8a29e",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Gårdsguiden
        </span>
      </div>

      {/* Push content to bottom third */}
      <div style={{ flex: 1 }} />

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow && (
          <span
            style={{
              fontSize: 22,
              fontWeight: 400,
              color: "#a8a29e",
              marginBottom: 8,
              display: "block",
            }}
          >
            {eyebrow}
          </span>
        )}

        <span
          style={{
            fontSize: titleSize,
            fontWeight: 700,
            color: "#1c1917",
            lineHeight: 1.15,
            display: "block",
          }}
        >
          {title}
        </span>

        {subtitle && (
          <span
            style={{
              fontSize: 22,
              fontWeight: 400,
              color: "#78716c",
              marginTop: 16,
              display: "block",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {/* Amber accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 12,
          backgroundColor: "#F59E0B",
        }}
      />
    </div>
  );
}
