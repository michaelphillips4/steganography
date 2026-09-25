import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";

afterEach(() => {
  cleanup();
});

function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

describe("application navigation", () => {
  it("shows the home introduction and steganography reference", () => {
    renderApp();

    expect(screen.getByText(/simple web application/i)).toBeTruthy();
    expect(
      (screen.getByRole("link", { name: "Steganography on Wikipedia" }) as HTMLAnchorElement)
        .href
    ).toBe("https://en.wikipedia.org/wiki/Steganography");
    expect(screen.getByRole("link", { name: "Encrypt Text" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Decrypt Text" })).toBeTruthy();
  });

  it("navigates to both workflows and keeps the site navigation available", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("link", { name: "Encrypt Text" }));
    expect(screen.getByLabelText(/Text to hide/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Decrypt Text" })).toBeTruthy();

    await user.click(screen.getByRole("link", { name: "Decrypt Text" }));
    expect(screen.getByLabelText(/Choose an image containing hidden text/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
  });

  it("generates, reveals, and copies a strong password with local feedback", async () => {
    const user = userEvent.setup();
    renderApp("/hide");

    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      await user.click(screen.getByRole("button", { name: "Create strong password" }));
      const passwordInput = screen.getByLabelText(/Create Encryption password/) as HTMLInputElement;
      const password = passwordInput.value;

      expect(password).toHaveLength(24);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^a-zA-Z0-9]/);
      expect(passwordInput.type).toBe("password");

      await user.click(screen.getByRole("button", { name: "Show password" }));
      expect(passwordInput.type).toBe("text");

      await user.click(screen.getByRole("button", { name: "Copy password" }));
      expect(writeText).toHaveBeenCalledWith(password);
      const feedback = screen.getByText("Password copied to clipboard.");
      expect(screen.getByRole("group", { name: "Encryption password and actions" }).nextElementSibling).toBe(
        feedback
      );
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: originalClipboard,
      });
    }
  });
});
