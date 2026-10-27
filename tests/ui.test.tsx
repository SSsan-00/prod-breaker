import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import React from "react";
import Game from "../src/components/Game";
vi.mock("../src/components/Arena", () => ({
  default: () => <canvas aria-label="ゲームフィールド" />,
}));
it("starts a real-time run in one tap and exposes movement, timer and panic", () => {
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  render(<Game />);
  fireEvent.click(screen.getByRole("button", { name: /QUICK/ }));
  fireEvent.click(screen.getByText(/GAME START/));
  expect(screen.getByTestId("timer").textContent).toBe("1:30");
  expect(screen.getByRole("button", { name: /PANIC/ })).toBeTruthy();
  expect(screen.queryByText("DEPLOY ↗")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "一時停止" }));
  expect(screen.getByRole("dialog", { name: "一時停止" })).toBeTruthy();
  cleanup();
  vi.unstubAllGlobals();
});
