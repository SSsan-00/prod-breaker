import type { Metadata } from "next";
import "./globals.css";
const title = "PROD BREAKER SURVIVOR — BUILD THE BUG.";
const description = "暴走バグを操作し、自動攻撃と連鎖爆発で架空の本番環境を生き延びるサバイバーゲーム。";
const image = { url: "/icon-512.png", alt: "PROD BREAKERの暴走バグ" };
export const metadata: Metadata = {
  metadataBase: new URL("https://prod-breaker.vercel.app"),
  title,
  applicationName: "PROD BREAKER",
  appleWebApp: { title: "PROD BREAKER" },
  description,
  openGraph: {
    type: "website", url: "/", siteName: "PROD BREAKER", locale: "ja_JP",
    title, description, images: [{ ...image, width: 512, height: 512 }],
  },
  twitter: { card: "summary", title, description, images: [image] },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
