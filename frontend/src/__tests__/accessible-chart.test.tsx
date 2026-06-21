import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import AccessibleChart from "@/components/AccessibleChart";

describe("AccessibleChart Component", () => {
  const mockData = [
    { label: "Jan", val: 10 },
    { label: "Feb", val: 12 },
  ];
  const fields = [
    { key: "label", label: "Month" },
    { key: "val", label: "Value" },
  ];

  it("renders a screen-reader-only data table for accessibility", () => {
    render(
      <AccessibleChart
        title="Test Chart"
        description="A test chart description"
        data={mockData}
        fields={fields}
      >
        <div data-testid="visual-chart">Visual Content</div>
      </AccessibleChart>
    );

    const container = screen.getByRole("img", { name: /test chart. a test chart description/i });
    expect(container).toBeInTheDocument();

    const heading = screen.getByRole("heading", { name: /test chart/i, level: 3 });
    expect(heading).toBeInTheDocument();

    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toBe("Month");
    expect(headers[1].textContent).toBe("Value");

    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(4);
    expect(cells[0].textContent).toBe("Jan");
    expect(cells[1].textContent).toBe("10");

    const visual = screen.getByTestId("visual-chart");
    expect(visual).toBeInTheDocument();
  });
});
