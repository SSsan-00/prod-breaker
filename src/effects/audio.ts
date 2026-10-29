import { escalationStep } from "../game/survivor";

let context: AudioContext | undefined;
export function sound(
  kind: "deploy" | "hit" | "destroy" | "panic" | "milestone",
  volume: number,
) {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    if (kind === "milestone") {
      const now = context.currentTime;
      [523.25, 659.25, 783.99].forEach((note, i) => {
        const tone = context!.createOscillator(), envelope = context!.createGain();
        tone.type = "triangle";
        tone.frequency.value = note;
        envelope.gain.setValueAtTime(0.001, now + i * 0.055);
        envelope.gain.linearRampToValueAtTime(volume * 0.045, now + i * 0.055 + 0.015);
        envelope.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.22);
        tone.connect(envelope).connect(context!.destination);
        tone.start(now + i * 0.055);
        tone.stop(now + i * 0.055 + 0.23);
      });
      return;
    }
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
/** Keep the original groove until the later waves, then rise gently each wave. */
export function musicParameters(waveNumber: number, duration = 1800) {
  const safeWave = Number.isFinite(waveNumber) ? Math.floor(waveNumber) : 1;
  const late = escalationStep(safeWave, duration);
  return { bpm: 132 + late * 1.5, pitch: Math.pow(2, late / 80) };
}
/** A compact, looping synth groove; all voices share a stoppable music bus. */
export function startMusic(volume: number, currentWave: () => number = () => 1, currentDuration: () => number = () => 1800) {
  try {
    context ??= new AudioContext();
    const audio = context;
    void audio.resume().catch(() => {});
    const bus = audio.createGain();
    bus.gain.value = Math.max(0, Math.min(1, volume)) * 0.18;
    bus.connect(audio.destination);
    const bass = [55, 0, 55, 82.41, 65.41, 0, 73.42, 82.41, 55, 0, 110, 82.41, 73.42, 65.41, 61.74, 0];
    const lead = [220, 0, 261.63, 0, 329.63, 0, 293.66, 0, 220, 0, 261.63, 329.63, 392, 0, 329.63, 293.66];
    let step = 0;
    let next = audio.currentTime + 0.04;
    let stopped = false;
    const tone = (frequency: number, at: number, length: number, type: OscillatorType, level: number, endFrequency = frequency) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + length);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(level, at + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
      oscillator.connect(envelope).connect(bus);
      oscillator.start(at);
      oscillator.stop(at + length + 0.01);
    };
    const schedule = () => {
      if (stopped || audio.state !== "running") return;
      // Avoid scheduling a backlog after a suspended tab or delayed timer.
      next = Math.max(next, audio.currentTime + 0.01);
      while (next < audio.currentTime + 0.18) {
        const index = step % 16;
        const { bpm, pitch } = musicParameters(currentWave(), currentDuration());
        if (bass[index]) tone(bass[index] * pitch, next, 0.23, "triangle", 0.45);
        if (lead[index]) tone(lead[index] * pitch, next, 0.12, "square", 0.08);
        if (index % 4 === 0) tone(130 * pitch, next, 0.16, "sine", 0.5, 42 * pitch);
        if (index % 4 === 2) tone(190 * pitch, next, 0.08, "triangle", 0.18, 75 * pitch);
        tone(2200 * pitch, next, 0.025, "square", index % 2 ? 0.035 : 0.055, 1200 * pitch);
        next += 60 / bpm / 2;
        step++;
      }
    };
    schedule();
    const timer = setInterval(schedule, 100);
    return () => {
      stopped = true;
      clearInterval(timer);
      bus.gain.cancelScheduledValues(audio.currentTime);
      bus.gain.setValueAtTime(0, audio.currentTime);
      bus.disconnect();
    };
  } catch {
    // Audio failure never blocks play.
    return () => {};
  }
}
