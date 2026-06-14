import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Coach from "@/app/coach/page";

// Mock framer-motion animations
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...rest }: any) => <div className={className} {...rest}>{children}</div>,
    button: ({ children, className, ...rest }: any) => <button className={className} {...rest}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("AI Coach page component", () => {
  it("renders success state and header by default", () => {
    render(<Coach />);
    expect(screen.getByRole("heading", { name: /ai sustainability copilot/i })).toBeInTheDocument();
    expect(screen.getByText("Hello! I am your AI Sustainability Coach. Ask me how to reduce your energy footprint, swap transportation modes, or calculate food impacts!")).toBeInTheDocument();
  });

  it("handles loading state in deck selector", () => {
    render(<Coach />);
    const loadingBtn = screen.getByRole("button", { name: /loading/i });
    fireEvent.click(loadingBtn);
    expect(screen.getByText("Initializing Environment Mentor...")).toBeInTheDocument();
  });

  it("handles empty state in deck selector", () => {
    render(<Coach />);
    const emptyBtn = screen.getByRole("button", { name: /empty/i });
    fireEvent.click(emptyBtn);
    expect(screen.getByText("No Active Consultations")).toBeInTheDocument();
  });

  it("handles error state in deck selector", () => {
    render(<Coach />);
    const errorBtn = screen.getByRole("button", { name: /error/i });
    fireEvent.click(errorBtn);
    expect(screen.getByText("Connection Interrupted")).toBeInTheDocument();
  });

  it("renders prompt pills quick actions", () => {
    render(<Coach />);
    expect(screen.getByRole("button", { name: /how do i optimize transport\?/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /impact of beef vs tofu\?/i })).toBeInTheDocument();
  });

  it("renders weekly challenges widget", () => {
    render(<Coach />);
    expect(screen.getByText("Weekly Challenges")).toBeInTheDocument();
    expect(screen.getByText("Transit Trial")).toBeInTheDocument();
    expect(screen.getByText("Vampire Slayer")).toBeInTheDocument();
  });

  it("triggers roadmap generation action", () => {
    render(<Coach />);
    const genBtn = screen.getByRole("button", { name: /compile custom roadmap/i });
    expect(genBtn).toBeInTheDocument();
  });
});
