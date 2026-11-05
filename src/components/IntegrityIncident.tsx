"use client";

export default function IntegrityIncident({ onClose }: { onClose: () => void }) {
  return <div className="integrity-backdrop" onKeyDown={(event) => {
    event.stopPropagation();
    if (event.key === "Escape") onClose();
    if (event.key === "Tab") event.preventDefault();
  }}>
    <section className="integrity-incident" role="alertdialog" aria-modal="true" aria-labelledby="integrity-title" aria-describedby="integrity-description">
      <div className="integrity-code"><i aria-hidden="true" />INTEGRITY BREACH / 400</div>
      <div className="integrity-apparition" aria-hidden="true">
      <span className="integrity-ghost-text">INVALID INVALID INVALID</span>
      <svg className="integrity-face" viewBox="0 0 260 160" aria-hidden="true">
        <defs><radialGradient id="breach-eye"><stop stopColor="#ffefcf"/><stop offset=".25" stopColor="#ff5b60"/><stop offset="1" stopColor="#530910"/></radialGradient></defs>
        <path className="integrity-face-frame" d="m31 23 40-14 20 6 39-8 40 9 22-6 38 18 8 41-15 11 7 35-36 31-38-5-27 12-33-13-32 4-37-29 7-38-12-13Z" />
        <path className="integrity-cracks" d="m89 15 9 21-13 12 8 20m78-52-9 17 13 11-7 25M130 7l-9 26 12 17-7 32m-95-6 27 5-10 18m182-19-27 4 9 20M67 88l-8 16 8 16-9 19m126-50 8 17-8 16 8 17M97 87l-5 13 14 7m58-20 5 13-14 7" />
        <path className="integrity-scar" d="M25 32 9 47l14 8-9 18m220-41 16 15-14 8 9 18M45 118l-12 18 14-3 4 18m164-33 12 18-14-3-4 18" />
        <path className="integrity-eye-sockets" d="m47 49 59 7-10 29-35 4-18-19Zm166 0-59 7 10 29 35 4 18-19Z" />
        <g className="integrity-eyes"><ellipse cx="78" cy="69" rx="15" ry="9"/><ellipse cx="182" cy="69" rx="15" ry="9"/></g>
        <path className="integrity-eye-veins" d="m64 69-15-7m16 10-13 6m144-9 15-7m-16 10 13 6" />
        <path className="integrity-pupils" d="M76 59h4v20h-4zm104 0h4v20h-4Z" />
        <path className="integrity-mouth" d="m66 102 22 7 24 5h36l23-5 23-7-10 24-28 10h-51l-29-10Z" />
        <path className="integrity-teeth" d="m84 109 4 16m13-12 2 19m16-17v19m17-19v19m16-20-2 19m17-23-5 19m17-22-6 16" />
      </svg>
      </div>
      <p className="integrity-kicker">THE LOGS ARE WATCHING</p>
      <h2 id="integrity-title">ACCESS DENIED<span>_</span></h2>
      <p className="integrity-message">その記録、見逃さない。</p>
      <div className="integrity-terminal" aria-hidden="true"><span><b>REPLAY</b> DOES NOT MATCH</span><span><b>SCORE</b> REJECTED</span><span className="integrity-terminal-last">&gt; その数字は、ここには存在しない。<br />&gt; 正しい記録を、持ってこい。</span></div>
      <p id="integrity-description" className="integrity-description">プレイ記録を検証できませんでした。<br />スコアは登録されていません。</p>
      <button autoFocus type="button" className="integrity-close" onClick={onClose}>画面に戻る <span aria-hidden="true">↗</span></button>
      <div className="integrity-footer">PROD BREAKER / ACCESS CONTROL</div>
    </section>
  </div>;
}
