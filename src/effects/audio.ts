import { escalationStep } from "../game/survivor";

let context: AudioContext | undefined;
export function sound(
  kind: "deploy" | "hit" | "destroy" | "panic" | "milestone" | "breach",
  volume: number,
) {
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    if (kind === "breach") {
      const audio = context, now = audio.currentTime;
      for (const hz of [55, 58.27, 110]) {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(hz, now);
        oscillator.frequency.exponentialRampToValueAtTime(hz * .65, now + 1.3);
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(Math.max(.0001, Math.min(1, volume) * .035), now + .16);
        gain.gain.exponentialRampToValueAtTime(.0001, now + 1.4);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(now); oscillator.stop(now + 1.45);
      }
      return;
    }
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
  if (duration === 1800 && safeWave >= 61) {
    const secretStep = Math.min(9, safeWave - 61);
    return { bpm: 160 + secretStep * 2, pitch: Math.pow(2, (12 + secretStep) / 60) };
  }
  const late = escalationStep(safeWave, duration);
  return { bpm: 132 + late * 2, pitch: Math.pow(2, late / 60) };
}
export type MusicEnergy = { combo: number; overdrive: boolean };
/** Evolving synth arrangement; timing and voices share a single stoppable bus. */
export function startMusic(volume: number, currentWave: () => number = () => 1, currentDuration: () => number = () => 1800, currentEnergy: () => MusicEnergy = () => ({ combo: 0, overdrive: false })) {
  try {
    context ??= new AudioContext();
    const audio = context;
    void audio.resume().catch(() => {});
    const bus = audio.createGain();
    bus.gain.value = Math.max(0, Math.min(1, volume)) * 0.18;
    const graph: AudioNode[] = [];
    let echo: DelayNode | undefined;
    let filter: BiquadFilterNode | undefined;
    // Older/mock contexts can still play the dry score.
    if (typeof audio.createDynamicsCompressor === "function") {
      const compressor = audio.createDynamicsCompressor();
      compressor.threshold.value = -16; compressor.knee.value = 12;
      compressor.ratio.value = 3; compressor.attack.value = 0.008; compressor.release.value = 0.18;
      bus.connect(compressor).connect(audio.destination);
      graph.push(compressor);
    } else bus.connect(audio.destination);
    if (typeof audio.createBiquadFilter === "function" && typeof audio.createDelay === "function") {
      filter = audio.createBiquadFilter(); filter.type = "lowpass";
      filter.frequency.value = 4200; filter.Q.value = 0.6; filter.connect(bus);
      echo = audio.createDelay(1); echo.delayTime.value = 60 / 132 * 0.75;
      const feedback = audio.createGain(); feedback.gain.value = 0.24;
      const wet = audio.createGain(); wet.gain.value = 0.16;
      echo.connect(feedback).connect(echo); echo.connect(wet).connect(bus);
      graph.push(filter, echo);
    }
    // Am–F–C–G, with two bars per harmony and four arrangement sections.
    const roots = [55, 43.6535, 65.4064, 49];
    const motif = [0, -1, 3, 7, 12, -1, 10, 7, 0, 3, 7, -1, 15, 12, 10, 7];
    const bassPattern = [0, -1, 0, 12, 0, -1, 7, 12];
    let step = 0;
    let next = audio.currentTime + 0.04;
    let stopped = false;
    const tone = (frequency: number, at: number, length: number, type: OscillatorType, level: number, endFrequency = frequency, spacious = false, attack = 0.008) => {
      const oscillator = audio.createOscillator();
      const envelope = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + length);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(level, at + attack);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
      oscillator.connect(envelope).connect(spacious && filter ? filter : bus);
      if (spacious && echo) envelope.connect(echo);
      oscillator.start(at);
      oscillator.stop(at + length + 0.01);
    };
    const schedule = () => {
      if (stopped || audio.state !== "running") return;
      // Avoid scheduling a backlog after a suspended tab or delayed timer.
      next = Math.max(next, audio.currentTime + 0.01);
      while (next < audio.currentTime + 0.18) {
        const index = step % 16, bar = Math.floor(step / 8), section = Math.floor(bar / 8) % 4;
        const wave = currentWave(), duration = currentDuration();
        const { bpm, pitch } = musicParameters(wave, duration);
        const energy = currentEnergy(), secret = duration === 1800 && wave >= 61;
        const driven = energy.overdrive || energy.combo >= 300 || secret;
        const breakdown = section === 3 && !driven;
        const rootIndex = Math.floor(bar / 2) % roots.length, root = roots[rootIndex] * pitch;
        const eighth = 60 / bpm / 2;
        if (filter) filter.frequency.setTargetAtTime(driven ? 6800 : breakdown ? 2200 : 4200, next, 0.2);
        if (echo) echo.delayTime.setTargetAtTime(60 / bpm * 0.75, next, 0.1);
        if (step % 16 === 0) {
          for (const interval of [0, rootIndex === 0 ? 3 : 4, 7])
            tone(root * 4 * Math.pow(2, interval / 12), next, eighth * 15, "triangle", 0.045, undefined, true, 0.18);
        }
        const bassNote = bassPattern[step % 8];
        if (bassNote >= 0 && (!breakdown || step % 4 === 0))
          tone(root * Math.pow(2, bassNote / 12), next, eighth * 0.8, "triangle", 0.38);
        const rawNote = motif[index];
        const note = rootIndex !== 0 && (rawNote === 3 || rawNote === 15) ? rawNote + 1 : rawNote;
        if (note >= 0 && (!breakdown || index % 4 === 0))
          tone(root * 4 * Math.pow(2, note / 12), next, eighth * 0.65, "triangle", 0.13, undefined, true);
        if ((section === 1 || section === 2 || driven) && step % 2 === 1) {
          const interval = [0, 7, 12, rootIndex === 0 ? 15 : 16][Math.floor(step / 2) % 4];
          tone(root * 4 * Math.pow(2, interval / 12), next + eighth / 2, eighth * 0.3, "sine", driven ? 0.12 : 0.07, undefined, true);
        }
        if (step % 8 === 7 && bar % 8 === 7)
          for (let i = 1; i <= 3; i++) tone(root * 8 * Math.pow(2, i / 12), next + eighth * i / 4, 0.04, "triangle", 0.07, undefined, true);
        if (!breakdown || step % 8 === 0) {
          if (index % 2 === 0) tone(130 * pitch, next, 0.16, "sine", 0.45, 42 * pitch);
          if (index % 4 === 2) tone(190 * pitch, next, 0.08, "triangle", 0.14, 75 * pitch);
        }
        tone(2200 * pitch, next, 0.025, "square", index % 2 ? 0.025 : 0.04, 1200 * pitch);
        // Add a driving offbeat pulse during the final five-minute incident.
        if (secret)
          tone(1650 * pitch, next + 60 / bpm / 4, 0.025, "square", 0.025, 900 * pitch);
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
      for (const node of graph) node.disconnect();
    };
  } catch {
    // Audio failure never blocks play.
    return () => {};
  }
}
