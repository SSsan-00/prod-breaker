let context: AudioContext | undefined;
function ctx() {
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context;
}
export function tone(
  kind: "hit" | "rescue" | "upgrade" | "panic",
  volume: number,
) {
  try {
    const c = ctx(),
      o = c.createOscillator(),
      g = c.createGain(),
      t = c.currentTime;
    o.type = kind === "hit" ? "triangle" : "sine";
    o.frequency.setValueAtTime(
      kind === "panic"
        ? 90
        : kind === "rescue"
          ? 660
          : kind === "upgrade"
            ? 440
            : 180,
      t,
    );
    o.frequency.exponentialRampToValueAtTime(
      kind === "panic" ? 32 : kind === "hit" ? 60 : 880,
      t + 0.22,
    );
    g.gain.setValueAtTime(volume * 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.32);
  } catch {}
}
export function music(volume: number, getWave: () => number) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const nodes: AudioNode[] = [];
  try {
    const c = ctx(),
      bus = c.createGain();
    bus.gain.value = volume * 0.045;
    bus.connect(c.destination);
    nodes.push(bus);
    let beat = 0,
      next = c.currentTime;
    const tick = () => {
      while (next < c.currentTime + 0.15) {
        const wave = getWave();
        const pattern = [
          45, 52, 57, 60, 45, 55, 59, 64, 41, 48, 53, 57, 43, 50, 55, 59,
        ];
        const midi = pattern[beat % pattern.length];
        const o = c.createOscillator(),
          g = c.createGain();
        o.type = beat % 4 === 0 ? "triangle" : "sine";
        o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
        g.gain.setValueAtTime(0, next);
        g.gain.linearRampToValueAtTime(
          beat % 4 === 0 ? 0.8 : 0.4,
          next + 0.015,
        );
        g.gain.exponentialRampToValueAtTime(0.001, next + 0.5);
        o.connect(g).connect(bus);
        o.start(next);
        o.stop(next + 0.55);
        o.onended = () => {
          o.disconnect();
          g.disconnect();
        };
        if (beat % 4 === 0) {
          const bass = c.createOscillator(),
            b = c.createGain();
          bass.frequency.setValueAtTime(85, next);
          bass.frequency.exponentialRampToValueAtTime(35, next + 0.12);
          b.gain.setValueAtTime(0.8, next);
          b.gain.exponentialRampToValueAtTime(0.001, next + 0.2);
          bass.connect(b).connect(bus);
          bass.start(next);
          bass.stop(next + 0.22);
          bass.onended = () => {
            bass.disconnect();
            b.disconnect();
          };
        }
        next += 60 / (108 + wave * 2) / 2;
        beat++;
      }
    };
    tick();
    timer = setInterval(tick, 60);
  } catch {}
  return () => {
    if (timer) clearInterval(timer);
    for (const n of nodes) n.disconnect();
  };
}
