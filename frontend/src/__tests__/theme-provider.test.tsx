import { render, screen, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";

function TestConsumer() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <button onClick={() => setTheme("high-contrast")}>Set contrast</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("provides theme context and sets default theme to dark", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const span = screen.getByTestId("theme-val");
    expect(span.textContent).toBe("dark");
  });

  it("updates the theme state when setTheme is called", () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    const button = screen.getByRole("button", { name: /set contrast/i });
    act(() => {
      button.click();
    });

    expect(screen.getByTestId("theme-val").textContent).toBe("high-contrast");
    expect(document.documentElement).toHaveClass("high-contrast");
  });
});
