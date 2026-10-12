import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App, { demoLoader, type Loader } from "./App";

const NOW = Date.UTC(2026, 9, 12, 17, 4, 20);

function setup(loader: Loader = demoLoader) {
  render(<App now={NOW} loader={loader} />);
  return userEvent.setup();
}

const rows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);

describe("Metrics dashboard", () => {
  it("shows KPI tiles, charts and the service table", async () => {
    setup();
    expect(await screen.findByText("Demo data")).toBeInTheDocument();
    for (const name of ["Requests/s", "Error rate", "p95 latency", "CPU"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("img", { name: /Use the arrow keys/ })).toHaveLength(4);
    expect(rows()).toHaveLength(7);
    // Sorted by status: search is degraded by the latency incident.
    expect(rows()[0]).toHaveTextContent("search");
    expect(rows()[0]).toHaveTextContent("degraded");
  });

  it("switches the time range", async () => {
    const loader = vi.fn(demoLoader);
    const user = setup(loader);
    await screen.findByText("Demo data");
    await user.click(screen.getByRole("button", { name: "24 h" }));
    expect(screen.getByRole("button", { name: "24 h" })).toHaveAttribute("aria-pressed", "true");
    expect(loader).toHaveBeenLastCalledWith("24h", NOW);
    expect(await screen.findByText(/Last 24 h · 10 min resolution/)).toBeInTheDocument();
  });

  it("reads chart values with the keyboard", async () => {
    const user = setup();
    await screen.findByText("Demo data");
    const chart = screen.getByRole("img", { name: /^Throughput/ });
    chart.focus();
    await user.keyboard("{End}");
    const tooltip = within(chart.parentElement!).getByRole("status");
    expect(tooltip).toHaveTextContent(/req\/s/);
    await user.keyboard("{Escape}");
    expect(within(chart.parentElement!).queryByRole("status")).not.toBeInTheDocument();
  });

  it("sorts the table by a column", async () => {
    const user = setup();
    await screen.findByText("Demo data");
    await user.click(screen.getByRole("button", { name: /Requests\/s/ }));
    expect(rows()[0]).toHaveTextContent("api-gateway");
    await user.click(screen.getByRole("button", { name: /Service/ }));
    expect(rows()[0]).toHaveTextContent("api-gateway");
    expect(rows().at(-1)).toHaveTextContent("search");
  });

  it("explains a Prometheus failure and offers demo data", async () => {
    const failing: Loader = async () => {
      throw new Error("Prometheus answered 502");
    };
    const user = setup(failing);
    expect(await screen.findByRole("alert")).toHaveTextContent("Prometheus answered 502");
    await user.click(screen.getByRole("button", { name: "Show demo data" }));
    expect(await screen.findByText("Demo data")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
