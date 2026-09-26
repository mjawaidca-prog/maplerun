import { ImageResponse } from "next/og";

export const alt = "Nexvar Pay — Canadian payroll software";
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
          background: "#070D14",
          color: "white",
          padding: "72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 34, fontWeight: 800 }}>
          <div style={{ display: "flex", width: 58, height: 58, borderRadius: 14, alignItems: "center", justifyContent: "center", background: "#B3261E" }}>
            N
          </div>
          Nexvar Pay
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: 980 }}>
          <div style={{ fontSize: 74, lineHeight: 1.05, fontWeight: 900 }}>
            Canadian payroll, done with clarity
          </div>
          <div style={{ fontSize: 30, color: "#D7DDE5" }}>
            CPP, EI, tax calculations, pay stubs, payroll reports, and accountant workflows in one place.
          </div>
        </div>
        <div style={{ display: "flex", color: "#FCA5A5", fontSize: 24 }}>A product of Nexvar Lab Inc.</div>
      </div>
    ),
    size,
  );
}
