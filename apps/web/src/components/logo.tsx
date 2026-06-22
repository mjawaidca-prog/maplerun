import Image from "next/image";

type LogoVariant = "full" | "icon";

interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  className?: string;
}

/**
 * NexvarLab logo — geometric "N" mark + wordmark.
 * Use "full" for landing/auth pages, "icon" for sidebar/favicon spots.
 */
export function Logo({ variant = "full", size, className }: LogoProps) {
  const src = variant === "icon" ? "/logo-icon.svg" : "/logo.svg";

  if (variant === "icon") {
    const s = size ?? 32;
    return (
      <Image
        src={src}
        alt="NexvarLab"
        width={s}
        height={s}
        className={className}
        priority
      />
    );
  }

  // Full logo: icon (32px) + wordmark. Fixed 140:32 aspect ratio.
  const h = size ?? 28;
  const w = Math.round(h * (140 / 32));
  return (
    <Image
      src={src}
      alt="NexvarLab"
      width={w}
      height={h}
      className={className}
      priority
    />
  );
}

/**
 * Inline logo using just the icon SVG rendered as text — for email templates
 * and places where Image/Next.js isn't available.
 */
export function LogoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="24"
      height="24"
      fill="none"
      aria-label="NexvarLab"
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <rect width="32" height="32" rx="8" fill="#0F172A" />
      <path
        d="M10 24V10L17 22L24 8V24"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
