let context: AudioContext | undefined;
export function sound(
  kind: "deploy" | "hit" | "destroy" | "panic",
  volume: number,
) {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    const osc = context.createOscillator(),
      gain = context.createGain();
    osc.type = kind === "destroy" ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(
      kind === "destroy"
        ? 110
        : kind === "panic"
          ? 650
          : kind === "deploy"
            ? 260
            : 420,
      context.currentTime,
    );
    osc.frequency.exponentialRampToValueAtTime(35, context.currentTime + 0.18);
    gain.gain.setValueAtTime(volume * 0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.22);
    osc.connect(gain).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.23);
  } catch {
    /* Audio failure never blocks play. */
  }
}
export function startMusic(volume: number) {
  let beat = 0;
  const notes = [55, 82.41, 65.41, 73.42, 55, 110, 82.41, 73.42];
  const tick = () => {
    try {
      context ??= new AudioContext();
      void context.resume().catch(() => {});
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.type = "triangle";
      osc.frequency.value = notes[beat++ % notes.length];
      gain.gain.setValueAtTime(volume * 0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.32);
      osc.connect(gain).connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.35);
    } catch {}
  };
  tick();
  const timer = setInterval(tick, 370);
  return () => clearInterval(timer);
}
