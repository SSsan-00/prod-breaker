import { it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Game from "../src/components/Game";
it("starts in one tap and exposes accessible server controls", () => {
  render(<Game />);
  fireEvent.click(screen.getByText(/GAME START/));
  expect(screen.getByRole("button", { name: /DB ノード/ })).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /DEPLOY ↗/ }).hasAttribute("disabled"),
  ).toBe(true);
});
