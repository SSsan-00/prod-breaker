import { afterEach, describe, expect, it, vi } from "vitest";
import { musicParameters } from "../src/effects/audio";

describe("late-wave music", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("keeps the original music through wave 49, then increases gently each wave", () => {
    expect(musicParameters(49)).toEqual({ bpm: 132, pitch: 1 });
    for (let wave = 50; wave <= 60; wave++) {
      expect(musicParameters(wave).bpm).toBe(musicParameters(wave - 1).bpm + 1);
      expect(musicParameters(wave).pitch).toBeGreaterThan(musicParameters(wave - 1).pitch);
    }
    expect(musicParameters(60).bpm).toBe(143);
    expect(musicParameters(60).pitch).toBeCloseTo(Math.pow(2, 11 / 120));
  });
  it("starts the same musical progression in the later waves of every mode", () => {
    for (const [duration, start] of [[90, 2], [180, 4], [300, 6], [1800, 50]]) {
      expect(musicParameters(start - 1, duration)).toEqual({ bpm: 132, pitch: 1 });
      expect(musicParameters(start, duration).bpm).toBe(133);
      expect(musicParameters(start + 1, duration).bpm).toBe(134);
      expect(musicParameters(start + 1, duration).pitch).toBeGreaterThan(musicParameters(start, duration).pitch);
    }
    expect(musicParameters(3, 90).bpm).toBe(134);
    expect(musicParameters(6, 180).bpm).toBe(135);
    expect(musicParameters(10, 300).bpm).toBe(137);
  });
  it("updates pitch and tempo in the same music session without disconnecting", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.resetModules();
    const notes: { hz: number; at: number }[] = [];
    let disconnects = 0;
    class FakeAudioContext {
      state = "running";
      destination = {};
      get currentTime() { return Date.now() / 1000; }
      resume() { return Promise.resolve(); }
      createGain() {
        return {
          gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
          connect: (target: unknown) => target,
          disconnect: () => { disconnects++; },
        };
      }
      createOscillator() {
        return {
          type: "",
          frequency: { setValueAtTime: (hz: number, at: number) => notes.push({ hz, at }), exponentialRampToValueAtTime() {} },
          connect: (target: unknown) => target,
          start() {}, stop() {},
        };
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const { startMusic } = await import("../src/effects/audio");
    let wave = 49, duration = 1800;
    const stop = startMusic(0.5, () => wave, () => duration);
    vi.advanceTimersByTime(1000);
    const oldHats = notes.filter(note => note.hz === 2200);
    expect(oldHats.length).toBeGreaterThan(2);
    expect(oldHats[1].at - oldHats[0].at).toBeCloseTo(60 / 132 / 2);
    wave = 50;
    vi.advanceTimersByTime(1000);
    const newHats = notes.filter(note => Math.abs(note.hz - 2200 * musicParameters(50).pitch) < 1e-7);
    expect(newHats.length).toBeGreaterThan(2);
    expect(newHats[1].at - newHats[0].at).toBeCloseTo(60 / 133 / 2);
    expect(disconnects).toBe(0);
    wave = 3; duration = 90;
    vi.advanceTimersByTime(1000);
    const quickHats = notes.filter(note => Math.abs(note.hz - 2200 * musicParameters(3, 90).pitch) < 1e-7);
    expect(quickHats.length).toBeGreaterThan(2);
    expect(quickHats[1].at - quickHats[0].at).toBeCloseTo(60 / 134 / 2);
    expect(disconnects).toBe(0);
    stop();
    expect(disconnects).toBe(1);
    const count = notes.length;
    vi.advanceTimersByTime(500);
    expect(notes).toHaveLength(count);
  });
});
