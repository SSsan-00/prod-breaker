import { it, expect, vi } from "vitest";
import { load, save } from "../src/lib/storage";
it("works when storage is unavailable or corrupt", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(load("pk-best", 0)).toBe(0);
  expect(() => save("pk-best", 50)).not.toThrow();
  vi.restoreAllMocks();
  localStorage.setItem("bad", "{");
  expect(load("bad", false)).toBe(false);
});
