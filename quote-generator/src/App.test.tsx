import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { demoQuote } from "./data";

const NOW = new Date(2026, 9, 12, 10, 0);
const norm = (s: string | null) => (s ?? "").replace(/ /g, " ");

function setup() {
  render(<App now={NOW} storage={localStorage} />);
  return userEvent.setup();
}

const preview = () => screen.getByRole("article", { name: /Pré-visualização do orçamento/ });
const grandTotal = () => norm(within(screen.getByRole("table", { name: "Totais" })).getByText("Total").nextElementSibling!.textContent);

beforeEach(() => localStorage.clear());

describe("Quote generator", () => {
  it("renders the demo quote with totals in reais and the validity date", () => {
    setup();
    expect(grandTotal()).toBe("R$ 12.985,31");
    expect(within(preview()).getByText("Padaria Pão Dourado Ltda.")).toBeInTheDocument();
    expect(within(preview()).getAllByText(/27\/10\/2026/).length).toBeGreaterThan(0);
    expect(screen.getByText("Válido até 27/10/2026")).toBeInTheDocument();
  });

  it("updates the preview live when items change", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Adicionar item" }));
    const desc = screen.getByLabelText("Descrição do item 6");
    expect(desc).toHaveFocus();
    await user.type(desc, "Visita técnica");
    const qty = screen.getByLabelText("Quantidade do item 6");
    await user.clear(qty);
    await user.type(qty, "1,5");
    const price = screen.getByLabelText("Valor unitário do item 6");
    await user.clear(price);
    await user.type(price, "1.200,00");
    await user.tab();
    expect(price).toHaveValue("1.200,00");
    expect(norm(screen.getByLabelText("Total do item 6").textContent)).toBe("R$ 1.800,00");
    expect(within(preview()).getByText("Visita técnica")).toBeInTheDocument();
    // 12.607,10 + 1.800,00 = 14.407,10; + 3% ISS = 14.839,31
    expect(grandTotal()).toBe("R$ 14.839,31");

    await user.click(screen.getByRole("button", { name: "Remover item 6" }));
    expect(within(preview()).queryByText("Visita técnica")).not.toBeInTheDocument();
    expect(grandTotal()).toBe("R$ 12.985,31");
  });

  it("applies the global discount and tax rate", async () => {
    const user = setup();
    const discount = screen.getByLabelText("Desconto geral (R$)");
    await user.clear(discount);
    await user.type(discount, "0");
    const tax = screen.getByLabelText("Alíquota (%)");
    await user.clear(tax);
    await user.type(tax, "5");
    // 12.807,10 + 5% = 13.447,46 (rounded to the cent)
    expect(grandTotal()).toBe("R$ 13.447,46");
    expect(within(preview()).getByText("ISS (5%)")).toBeInTheDocument();
  });

  it("validates the client CPF/CNPJ with a mask", async () => {
    const user = setup();
    const doc = screen.getByLabelText("CPF ou CNPJ", { selector: "#client-document" });
    await user.clear(doc);
    await user.type(doc, "52998224724");
    expect(doc).toHaveValue("529.982.247-24");
    await user.tab();
    expect(screen.getByText("CPF inválido.")).toBeInTheDocument();
    expect(doc).toHaveAttribute("aria-invalid", "true");
  });

  it("blocks printing while required data is missing", async () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = setup();
    await user.clear(screen.getByLabelText("Nome ou razão social", { selector: "#client-name" }));
    await user.click(screen.getByRole("button", { name: "Imprimir / PDF" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome do cliente.");
    expect(print).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Nome ou razão social", { selector: "#client-name" }), "Hotel Vale dos Vinhedos");
    await user.click(screen.getByRole("button", { name: "Imprimir / PDF" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("saves, lists and reopens drafts", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    expect(screen.getByText(/Rascunho ORC-2026-0142 salvo/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("quote-generator:drafts:v1")!)).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Novo" }));
    expect(screen.getByLabelText("Número")).toHaveValue("ORC-2026-0143");
    expect(screen.getByLabelText("Nome ou razão social", { selector: "#client-name" })).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Abrir rascunho ORC-2026-0142" }));
    expect(screen.getByLabelText("Número")).toHaveValue("ORC-2026-0142");
    expect(grandTotal()).toBe("R$ 12.985,31");
  });

  it("exports the quote as JSON", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:quote";
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Exportar JSON" }));
    expect(click).toHaveBeenCalled();
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(created[0]!);
    });
    const json = JSON.parse(text);
    expect(json.number).toBe("ORC-2026-0142");
    expect(json.items).toHaveLength(5);
  });

  it("imports a JSON file and rejects invalid ones", async () => {
    const user = setup();
    const input = screen.getByLabelText("Importar arquivo JSON");
    await user.upload(input, new File(["{}"], "x.json", { type: "application/json" }));
    expect(await screen.findByText(/Arquivo inválido/)).toBeInTheDocument();

    const other = { ...demoQuote("2026-09-01"), number: "ORC-2026-0099", client: { ...demoQuote("2026-09-01").client, name: "Vinícola Casa Sperafico" } };
    await user.upload(input, new File([JSON.stringify(other)], "ORC-2026-0099.json", { type: "application/json" }));
    expect(await screen.findByText("Orçamento ORC-2026-0099 importado.")).toBeInTheDocument();
    expect(within(preview()).getByText("Vinícola Casa Sperafico")).toBeInTheDocument();
  });
});
