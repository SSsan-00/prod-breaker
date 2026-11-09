export const durations = [90, 180, 300] as const;
export const modeLabel: Record<number, string> = { 90: "QUICK", 180: "STANDARD", 300: "OVERTIME" };
export const defaultNames = ["本番環境の守護神", "定時退勤の守り人", "眠れるオンコール", "ログの名探偵", "パッチ当ての達人", "善意を疑う番人", "権限を絞る職人", "復旧手順の賢者", "MFAの門番", "脆弱性の掃除人", "無事故の魔術師", "アラートの通訳", "バックアップの騎士", "平穏を守るSRE", "証明書更新の妖精", "ゼロトラストの盾", "ファイアウォール係", "疑わしきは隔離", "週末を守った人", "監査ログの番人", "検証環境の勇者", "深夜対応の卒業生", "429の伝道師", "インシデント未遂"];
export function validName(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() && [...value].length >= 1 && [...value].length <= 20 && !/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value);
}
export function randomPlayerName(current = "") {
  const names = defaultNames.filter((name) => name !== current);
  return names[Math.floor(Math.random() * names.length)];
}
export type ScoreEntry = { player_name: string; score: number; created_at: string };
