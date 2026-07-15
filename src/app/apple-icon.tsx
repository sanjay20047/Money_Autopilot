import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — same rising-bars mark as icon.svg, rendered to PNG.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0e5f58",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 12,
          paddingBottom: 40,
        }}
      >
        <div style={{ width: 26, height: 45, borderRadius: 8, background: "rgba(255,255,255,0.55)" }} />
        <div style={{ width: 26, height: 68, borderRadius: 8, background: "rgba(255,255,255,0.78)" }} />
        <div style={{ width: 26, height: 100, borderRadius: 8, background: "#ffffff" }} />
      </div>
    ),
    size
  );
}
