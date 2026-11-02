/**
 * Clerk component theming — matches the legacy auth pages: brand red
 * #B3261E, 10px control radii, Inter, bordered white card.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#B3261E",
    borderRadius: "10px",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "shadow-none border border-[#E7E5E4] rounded-2xl w-full bg-white",
    headerTitle: "text-[19px] font-extrabold tracking-[-0.01em] text-[#1C1917]",
    headerSubtitle: "text-[13px] text-[#78716C]",
    formButtonPrimary:
      "bg-[#B3261E] hover:bg-[#8F1D17] text-white text-sm font-semibold normal-case",
    footerActionLink: "text-[#B3261E] hover:text-[#8F1D17] font-semibold",
  },
};
