import localFont from "next/font/local";

export const poppins = localFont({
  src: [
    { path: "../assets/fonts/Poppins-Regular.ttf", weight: "400", style: "normal" },
    { path: "../assets/fonts/Poppins-Medium.ttf", weight: "500", style: "normal" },
    { path: "../assets/fonts/Poppins-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const nasalization = localFont({
  src: "../assets/fonts/Nasalization-Regular.ttf",
  weight: "400",
  style: "normal",
  variable: "--font-nasalization",
  display: "swap",
});
