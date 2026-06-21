import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import Dashboard from "@/app/dashboard/page";
import { useEcoStore } from "@/store/useEcoStore";

// Mock Recharts components for jsdom environment compatibility
vi.mock("recharts", () => {
  return {
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    RadarChart: ({ children }: any) => <div data-testid="radar-chart">{children}</div>,
    Radar: () => <div data-testid="radar" />,
    PolarGrid: () => <div data-testid="polar-grid" />,
    PolarAngleAxis: () => <div data-testid="polar-axis" />,
    AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div data-testid="area" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
  };
});

// Mock framer-motion animations
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...rest }: any) => <div className={className} {...rest}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe("Dashboard Reactive Flow", () => {
  beforeEach(() => {
    // Reset store state
    const state = useEcoStore.getState();
    state.setLogs([]);
  });

  it("updates the average carbon emissions display dynamically when new logs are loaded in store", () => {
    render(<Dashboard />);

    // Initially, no logs mean daily average is 0
    expect(screen.getByText("0.0")).toBeInTheDocument();

    // Now populate logs in store
    act(() => {
      useEcoStore.getState().setLogs([
        { id: 1, user_id: 1, category: "energy", subcategory: "electricity", value: 100, unit: "kWh", co2_equivalent: 40.0, date: "2026-06-20" },
        { id: 2, user_id: 1, category: "transportation", subcategory: "petrol_car", value: 50, unit: "km", co2_equivalent: 12.0, date: "2026-06-21" },
      ]);
    });

    // Total CO2 = 52.0. Daily average (divided by 4 simulated days) = 13.0
    expect(screen.getByText("13.0")).toBeInTheDocument();
  });
});
