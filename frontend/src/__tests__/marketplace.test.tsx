import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import Marketplace from "@/app/marketplace/page";

const MOCK_PROJECTS = [
  { id: 1, name: "Amazon Basin Forest Conservation", description: "Preventing deforestation and protecting critical ecosystems in Brazil's Acre state.", cost_per_ton: 15.0, co2_offset: 50000.0, image_url: "amazon_rainforest.png", verified_by: "VCS (Verified Carbon Standard)" },
  { id: 2, name: "Rajasthan Wind Power Project", description: "Displacing fossil fuel grid energy with clean wind turbine installations in India.", cost_per_ton: 11.5, co2_offset: 80000.0, image_url: "wind_farm.png", verified_by: "Gold Standard" }
];

describe("Marketplace page component", () => {
  it("renders projects list and information details", async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/api/marketplace/projects")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_PROJECTS)
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<Marketplace />);
    expect(screen.getByRole("heading", { name: /carbon offset marketplace/i })).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText("Amazon Basin Forest Conservation")).toBeInTheDocument();
      expect(screen.getByText("Rajasthan Wind Power Project")).toBeInTheDocument();
    });
  });

  it("updates offset calculation dynamically based on input", async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/api/marketplace/projects")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_PROJECTS)
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<Marketplace />);
    
    let usdInput;
    await waitFor(() => {
      usdInput = screen.getByLabelText(/purchase amount/i);
    });
    
    fireEvent.change(usdInput, { target: { value: "150" } });
    expect(screen.getByText("-10,000 kg CO2e")).toBeInTheDocument();
  });

  it("completes mock purchase and renders verified certificate layout", async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/api/marketplace/projects")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(MOCK_PROJECTS)
        });
      }
      if (url.includes("/purchase")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            id: 999,
            amount_bought: 15,
            co2_offsetted: 1000,
            purchased_at: new Date().toISOString(),
            project: MOCK_PROJECTS[0]
          })
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<Marketplace />);
    
    let usdInput;
    await waitFor(() => {
      usdInput = screen.getByLabelText(/purchase amount/i);
    });
    
    fireEvent.change(usdInput, { target: { value: "15" } });
    
    let submitBtn;
    await waitFor(() => {
      submitBtn = screen.getByRole("button", { name: /offset 1,000 kg co2e for \$15/i });
    });
    
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("VERIFIED CARBON REMOVAL CERTIFICATE")).toBeInTheDocument();
      expect(screen.getByText("-1,000 kg")).toBeInTheDocument();
    });
  });
});
