"use client";

export default function IntegrityIncident({ onClose }: { onClose: () => void }) {
  return <div className="integrity-backdrop" onKeyDown={(event) => {
    event.stopPropagation();
    if (event.key === "Escape") onClose();
    if (event.key === "Tab") event.preventDefault();
  }}>
    <section className="integrity-incident" role="alertdialog" aria-modal="true" aria-labelledby="integrity-title" aria-describedby="integrity-description">
      <div className="integrity-code">SECURITY INCIDENT / 400</div>
      <svg className="integrity-face" viewBox="0 0 240 120" aria-hidden="true">
        <path className="integrity-face-frame" d="M12 22 36 7h168l24 15v72l-24 19H36L12 94Z" />
        <path className="integrity-eyes" d="m38 36 61 14-8 24-32-5Zm164 0-61 14 8 24 32-5Z" />
        <path className="integrity-mouth" d="m84 91 36 8 36-8" />
      </svg>
      <p className="integrity-kicker">THE LOGS ARE WATCHING</p>
      <h2 id="integrity-title">ACCESS DENIED<span>_</span></h2>
      <p className="integrity-message">その記録、見逃さない。</p>
      <p id="integrity-description" className="integrity-description">プレイ記録を検証できませんでした。<br />スコアは登録されていません。<br />これはゲーム内の演出です。</p>
      <button autoFocus type="button" className="integrity-close" onClick={onClose}>画面に戻る <span aria-hidden="true">↗</span></button>
      <div className="integrity-footer">PROD BREAKER / SIMULATION ONLY</div>
    </section>
  </div>;
}
