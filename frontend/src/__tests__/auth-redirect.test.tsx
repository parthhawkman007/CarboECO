import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import AuthPage from "@/app/auth/page";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: mockPush,
    };
  },
}));

describe("AuthPage MFA and Redirection Flow", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("redirects the user to /dashboard upon successful MFA verification", async () => {
    render(<AuthPage />);

    // Click Google Sign-in button to trigger MFA screen entry
    const googleBtn = screen.getByRole("button", { name: /google account/i });
    fireEvent.click(googleBtn);

    // We should now see the MFA screen
    const mfaHeading = await screen.findByText(/MFA Authentication/i, {}, { timeout: 2000 });
    expect(mfaHeading).toBeInTheDocument();

    // Type 6-digit code into input
    const mfaInput = screen.getByPlaceholderText(/123456/i);
    fireEvent.change(mfaInput, { target: { value: "123456" } });

    // Submit MFA verification
    const verifyBtn = screen.getByRole("button", { name: /verify & continue/i });
    fireEvent.click(verifyBtn);

    // Assert redirection push to dashboard was invoked
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    }, { timeout: 2000 });
  });
});
