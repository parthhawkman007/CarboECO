import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import React from "react";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";

describe("ThemeToggle accessibility", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("exposes mutually exclusive pressed states for all theme buttons", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const light = screen.getByRole("button", { name: /switch to light theme/i });
    const dark = screen.getByRole("button", { name: /switch to dark theme/i });
    const highContrast = screen.getByRole("button", { name: /switch to high contrast theme/i });

    expect(screen.getByRole("group", { name: /theme selector/i })).toBeInTheDocument();
    expect(dark).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(highContrast);

    expect(light).toHaveAttribute("aria-pressed", "false");
    expect(dark).toHaveAttribute("aria-pressed", "false");
    expect(highContrast).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement).toHaveClass("high-contrast");
  });
});
