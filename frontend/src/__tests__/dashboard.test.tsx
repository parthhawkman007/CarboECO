import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import Dashboard from "@/app/dashboard/page";

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

describe("Dashboard page component", () => {
  beforeEach(() => {
    render(<Dashboard />);
  });

  it("renders the Mission Control header and title", () => {
    expect(screen.getByRole("heading", { name: /mission control console/i })).toBeInTheDocument();
    expect(screen.getByText("Real-time telemetry and target goal analysis")).toBeInTheDocument();
  });

  it("displays daily average and circular progress bar with correct role", () => {
    const progress = screen.getByRole("progressbar", { name: /daily carbon budget utilization progress/i });
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveAttribute("aria-valuenow");
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
  });

  it("renders AI Active Copilot recommendation items", () => {
    expect(screen.getByRole("heading", { name: /ai active copilot feed/i })).toBeInTheDocument();
    expect(screen.getByText("Transit Switch Priority")).toBeInTheDocument();
    expect(screen.getByText("Vegetarian Diet Option")).toBeInTheDocument();
  });

  it("renders Telemetry Logs History list", () => {
    expect(screen.getByRole("heading", { name: /telemetry logs history/i })).toBeInTheDocument();
    expect(screen.getByText("petrol car")).toBeInTheDocument();
    expect(screen.getByText("electricity")).toBeInTheDocument();
  });

  it("renders geographic offset radar map container", () => {
    expect(screen.getByRole("heading", { name: /geographic offset radar/i })).toBeInTheDocument();
    expect(screen.getByText("Verifications: Amazon & Rajasthan")).toBeInTheDocument();
  });
});
