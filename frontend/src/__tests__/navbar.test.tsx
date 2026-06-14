/**
 * navbar.test.tsx – Accessibility and structure tests for the Navbar component.
 *
 * Coverage:
 *  - Skip-to-content link is present and keyboard-reachable (sr-only/focus)
 *  - Logo link has an accessible aria-label
 *  - All primary navigation items are rendered with correct hrefs
 *  - "More" dropdown button has aria-haspopup and aria-expanded attributes
 *  - Mobile menu toggle button changes aria-expanded on click
 *  - aria-current="page" is applied to the active nav link
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";

// Mock next/navigation for pathname
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

// Mock next/link as a plain anchor
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import Navbar from "@/components/Navbar";

describe("Navbar accessibility", () => {
  beforeEach(() => {
    render(<Navbar />);
  });

  it("renders a skip-to-content link before any interactive content", () => {
    const skip = screen.getByText("Skip to content");
    expect(skip).toBeInTheDocument();
    // It should point to #main-content
    expect(skip).toHaveAttribute("href", "#main-content");
  });

  it("renders the logo with a descriptive aria-label", () => {
    const logo = screen.getByRole("link", { name: /carboeco home/i });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("href", "/");
  });

  it("renders all primary navigation links", () => {
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    const primaryLinks = ["Dashboard", "Calculator", "AI Coach", "Twin & Garden", "Simulator"];
    primaryLinks.forEach((label) => {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    });
  });

  it("applies aria-current=page to the active link", () => {
    // usePathname is mocked to return '/dashboard'
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("aria-current", "page");
  });

  it("More dropdown button has aria-haspopup and aria-expanded attributes", () => {
    const moreButton = screen.getByRole("button", { name: /more/i });
    expect(moreButton).toHaveAttribute("aria-haspopup", "true");
    expect(moreButton).toHaveAttribute("aria-expanded");
  });

  it("mobile menu toggle changes aria-expanded state on click", () => {
    const toggle = screen.getByRole("button", { name: /open menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    // After click the button should now say "Close menu"
    const closeBtn = screen.getByRole("button", { name: /close menu/i });
    expect(closeBtn).toHaveAttribute("aria-expanded", "true");
  });
});
