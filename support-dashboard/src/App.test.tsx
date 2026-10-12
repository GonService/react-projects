import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { demoTickets } from "./data";

const NOW = Date.parse("2026-10-12T15:00:00Z");

function setup() {
  render(<App initialTickets={demoTickets(NOW)} now={NOW} />);
  return userEvent.setup();
}

const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("Support queue", () => {
  it("shows the summary and open tickets ordered by deadline", () => {
    setup();
    const summary = screen.getByLabelText("Queue summary");
    expect(within(summary).getByText("Late").nextSibling).toHaveTextContent(/\d+/);
    expect(screen.getByText(/of 14 tickets/)).toBeInTheDocument();
    expect(rows()[0]).toHaveTextContent(/late/);
  });

  it("filters late tickets and searches", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Late" }));
    for (const row of rows()) expect(row).toHaveTextContent(/late$/);

    await user.click(screen.getByRole("button", { name: "All tickets" }));
    await user.type(screen.getByLabelText("Search"), "webhook");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toHaveTextContent("Payment confirmation webhook failing");
  });

  it("explains what to do when nothing matches", async () => {
    const user = setup();
    await user.type(screen.getByLabelText("Search"), "zzz");
    expect(screen.getByText(/No tickets match/)).toBeInTheDocument();
  });

  it("selecting a dot on the timeline highlights the ticket", async () => {
    const user = setup();
    const dot = screen.getByRole("button", { name: /#1047 Mobile app crashes/ });
    await user.click(dot);
    const row = rows().find((r) => r.textContent?.includes("1047"))!;
    expect(row).toHaveAttribute("aria-selected", "true");
  });
});
