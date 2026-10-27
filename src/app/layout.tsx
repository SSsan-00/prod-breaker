import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PROD BREAKER SURVIVOR — BUILD THE BUG.",
  description:
    "暴走バグを操作し、自動攻撃と連鎖爆発で90秒・3分・5分を生き延びるサバイバーゲーム。架空の本番環境で完結。",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
