import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Calculator from "@/app/calculator/page";

// Mock framer-motion animations
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...rest }: any) => <div className={className} {...rest}>{children}</div>,
    button: ({ children, className, ...rest }: any) => <button className={className} {...rest}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("Calculator page component", () => {
  it("renders manual logging form as default mode", () => {
    render(<Calculator />);
    expect(screen.getByRole("heading", { name: /ai carbon calculator/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /log transportation emissions/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/subtype/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/activity date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/value/i)).toBeInTheDocument();
  });

  it("switches to AI Scanner mode when requested", () => {
    render(<Calculator />);
    const scannerTab = screen.getByRole("button", { name: /ai scanner/i });
    fireEvent.click(scannerTab);
    expect(screen.getByRole("heading", { name: /gemini ai carbon scanner/i })).toBeInTheDocument();
    expect(screen.getByText(/select receipt, meal, or bill image/i)).toBeInTheDocument();
  });

  it("toggles Google Maps Route Assistant in transportation category", () => {
    render(<Calculator />);
    const toggleButton = screen.getByRole("button", { name: /calculate distance/i });
    fireEvent.click(toggleButton);
    expect(screen.getByLabelText(/start address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/destination/i)).toBeInTheDocument();
  });

  it("validates inputs and shows error for invalid numeric values", () => {
    render(<Calculator />);
    const submitBtn = screen.getByRole("button", { name: /calculate & log activity/i });
    
    // Set value to negative
    const valueInput = screen.getByLabelText(/value/i);
    fireEvent.change(valueInput, { target: { value: "-5.0" } });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/please enter a valid numeric consumption value greater than zero/i)).toBeInTheDocument();
  });

  it("renders category selector buttons", () => {
    render(<Calculator />);
    expect(screen.getByRole("button", { name: /transportation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /home utilities/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /food diet/i })).toBeInTheDocument();
  });

  it("supports category switching", () => {
    render(<Calculator />);
    const utilitiesBtn = screen.getByRole("button", { name: /home utilities/i });
    fireEvent.click(utilitiesBtn);
    expect(screen.getByRole("heading", { name: /log energy emissions/i })).toBeInTheDocument();
  });
});
