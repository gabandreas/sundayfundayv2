import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0c0e14",
        }}
      >
        <svg
          width="132"
          height="132"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="1.5"
            y="1.5"
            width="21"
            height="21"
            rx="4.5"
            fill="#11141c"
            stroke="#282e3d"
            strokeWidth="1.25"
          />
          <polygon points="6,6.5 18,6.5 15.5,9.5 6,9.5" fill="#f3f4f6" />
          <polygon points="8.5,10.75 18,10.75 15.5,13.75 6,13.75" fill="#10b78d" />
          <polygon points="6,15 15.5,15 13,18 6,18" fill="#9ca3af" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
