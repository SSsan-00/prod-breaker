import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(
    `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "prod-keeper.vercel.app"}`,
  ),
  title: "PROD KEEPER — 今日も、何も起こさせない。",
  description:
    "本番を守るセキュリティ防衛サバイバー。脅威を迎撃し、施設を救援して防衛網を取り戻そう。PROD BREAKERの姉妹作。",
  openGraph: {
    title: "PROD KEEPER",
    description: "今日も、何も起こさせない。",
    images: ["/social.png"],
  },
  twitter: { card: "summary_large_image", images: ["/social.png"] },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1819",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
