import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PROD BREAKER — BUILD THE BUG.",
  description:
    "架空の本番環境を連鎖爆破。90秒のエンジニア向けブラックコメディ・ゲーム。",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
