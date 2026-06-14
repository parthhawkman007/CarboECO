import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Community from "@/app/community/page";

// Mock WebSocketProvider
vi.mock("@/components/WebSocketProvider", () => ({
  useWebSocket: () => ({
    connected: true,
    events: [
      { id: "1", type: "chat", user: "Test User", message: "Hello Eco World!", timestamp: "12:00" }
    ],
    sendChatMessage: vi.fn(),
    sendMilestone: vi.fn()
  })
}));

describe("Community page component", () => {
  it("renders active eco groups list", () => {
    render(<Community />);
    expect(screen.getByRole("heading", { name: /community groups/i })).toBeInTheDocument();
    expect(screen.getByText("Zero Waste Neighborhood")).toBeInTheDocument();
    expect(screen.getByText("Metro Commuters Collective")).toBeInTheDocument();
  });

  it("handles join group button clicks", async () => {
    render(<Community />);
    const joinButtons = screen.getAllByRole("button", { name: /join group/i });
    expect(joinButtons.length).toBeGreaterThan(0);
    fireEvent.click(joinButtons[0]);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /joined/i })).toBeInTheDocument();
    });
  });

  it("renders the Create Eco Group form", () => {
    render(<Community />);
    expect(screen.getByRole("heading", { name: /create eco group/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("submits the create group form", async () => {
    render(<Community />);
    const nameInput = screen.getByLabelText(/group name/i);
    const descInput = screen.getByLabelText(/description/i);
    const launchBtn = screen.getByRole("button", { name: /launch group/i });

    fireEvent.change(nameInput, { target: { value: "Eco Champions" } });
    fireEvent.change(descInput, { target: { value: "A group focused on regional conservation." } });
    fireEvent.click(launchBtn);

    await waitFor(() => {
      expect(screen.getByText("Eco Champions")).toBeInTheDocument();
    });
  });

  it("renders the Live Eco Stream events list", () => {
    render(<Community />);
    expect(screen.getByRole("heading", { name: /live eco stream/i })).toBeInTheDocument();
    expect(screen.getByText(/"Hello Eco World!"/i)).toBeInTheDocument();
  });
});
