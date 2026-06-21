import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import Calculator from "@/app/calculator/page";
import { useEcoStore } from "@/store/useEcoStore";

// Mock framer-motion animations
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...rest }: any) => <div className={className} {...rest}>{children}</div>,
    button: ({ children, className, ...rest }: any) => <button className={className} {...rest}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("Calculator Logging Flow", () => {
  beforeEach(() => {
    // Reset logs
    useEcoStore.getState().setLogs([]);
  });

  it("submits a new log and adds it to the Zustand store upon form submission", async () => {
    // Mock global fetch to return a successful backend log persistence response
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 99,
            category: "energy",
            subcategory: "electricity",
            value: 120.0,
            unit: "kWh",
            co2_equivalent: 48.0,
            date: "2026-06-20",
          }),
      } as any)
    );

    render(<Calculator />);

    // Switch to Home Utilities
    const utilitiesTab = screen.getByRole("button", { name: /home utilities/i });
    fireEvent.click(utilitiesTab);

    expect(screen.getByRole("heading", { name: /log energy emissions/i })).toBeInTheDocument();

    // Select energy type
    const subtypeSelect = screen.getByLabelText(/subtype/i);
    fireEvent.change(subtypeSelect, { target: { value: "electricity" } });

    // Set a valid consumption value
    const valueInput = screen.getByLabelText(/value/i);
    fireEvent.change(valueInput, { target: { value: "120" } });

    // Submit form
    const submitBtn = screen.getByRole("button", { name: /calculate & log activity/i });
    fireEvent.click(submitBtn);

    // Success alert shown (waits for async fetch resolution)
    const successAlert = await screen.findByText(/added successfully/i);
    expect(successAlert).toBeInTheDocument();

    // Check store updated
    const logs = useEcoStore.getState().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].co2_equivalent).toBe(48.0);
    expect(logs[0].subcategory).toBe("electricity");
  });
});
