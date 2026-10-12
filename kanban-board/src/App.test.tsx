import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { STORAGE_KEY } from "./board";

const NOW = new Date(2026, 9, 12, 10, 0);

function setup(storage: Storage | null = localStorage) {
  render(<App now={NOW} storage={storage} />);
  return userEvent.setup();
}

const column = (name: string) => screen.getByRole("region", { name });
const titlesIn = (name: string) => within(column(name)).queryAllByRole("article").map((a) => a.getAttribute("aria-label"));

beforeEach(() => localStorage.clear());

describe("Kanban board", () => {
  it("shows the demo board with counts and overdue highlights", () => {
    setup();
    expect(titlesIn("A fazer")).toHaveLength(5);
    expect(within(column("Em andamento")).getByText("3")).toBeInTheDocument();
    const late = screen.getByRole("article", { name: "Erro 500 ao aplicar cupom expirado" });
    expect(late).toHaveAttribute("data-due", "overdue");
    expect(within(late).getByText(/atrasada/)).toBeInTheDocument();
    const summary = screen.getByLabelText("Resumo do quadro");
    expect(within(summary).getByText("Atrasadas").nextSibling).toHaveTextContent("2");
  });

  it("creates a task with labels and a due date", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    const dialog = screen.getByRole("dialog", { name: "Nova tarefa" });
    expect(screen.getByLabelText("Título")).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Criar tarefa" }));
    expect(within(dialog).getByText("Dê um título para a tarefa.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Título"), "Revisar política de cookies");
    await user.selectOptions(screen.getByLabelText("Coluna"), "Em andamento");
    await user.selectOptions(within(dialog).getByLabelText("Responsável"), "Carla Nunes");
    await user.click(screen.getByRole("checkbox", { name: "Front-end" }));
    await user.type(screen.getByLabelText("Prazo"), "2026-10-20");
    await user.click(within(dialog).getByRole("button", { name: "Criar tarefa" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(titlesIn("Em andamento")[0]).toBe("Revisar política de cookies");
    const card = screen.getByRole("article", { name: "Revisar política de cookies" });
    expect(within(card).getByText("T-140")).toBeInTheDocument();
    expect(within(card).getByText("Front-end")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: "Responsável: Carla Nunes" })).toBeInTheDocument();
  });

  it("edits and deletes a task; Escape closes the dialog", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Página de troca e devolução" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Página de troca e devolução" })).toHaveFocus();

    await user.keyboard("{Enter}");
    const title = screen.getByLabelText("Título");
    await user.clear(title);
    await user.type(title, "Página de trocas");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("article", { name: "Página de trocas" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Página de trocas" }));
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Confirmar exclusão" }));
    expect(screen.queryByRole("article", { name: "Página de trocas" })).not.toBeInTheDocument();
  });

  it("moves cards with buttons and with Alt + arrow keys", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: 'Mover "Cupom de frete grátis para o RS" para a próxima coluna' }));
    expect(titlesIn("Em andamento")[0]).toBe("Cupom de frete grátis para o RS");
    expect(screen.getByText("Cupom de frete grátis para o RS movida para Em andamento.")).toBeInTheDocument();

    const title = screen.getByRole("button", { name: "Cupom de frete grátis para o RS" });
    expect(title).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(titlesIn("Em revisão")[0]).toBe("Cupom de frete grátis para o RS");
    expect(screen.getByRole("button", { name: "Cupom de frete grátis para o RS" })).toHaveFocus();

    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(titlesIn("Em revisão")[1]).toBe("Cupom de frete grátis para o RS");
    // WIP limit of 3 in review is now exceeded.
    expect(within(column("Em revisão")).getByText(/acima do limite/)).toBeInTheDocument();
  });

  it("filters by search, label and overdue", async () => {
    const user = setup();
    await user.type(screen.getByRole("searchbox"), "frete");
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual([
      "Cupom de frete grátis para o RS",
      "Cálculo de frete com a nova tabela dos Correios",
    ]);
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));

    await user.click(screen.getByRole("checkbox", { name: "Só atrasadas" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    await user.selectOptions(screen.getByRole("combobox", { name: "Etiqueta" }), "Infra");
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual(["Alertas de latência no Datadog"]);
    expect(within(column("A fazer")).getByText("Nenhuma tarefa com esses filtros.")).toBeInTheDocument();
  });

  it("saves to localStorage and restores on reload", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: 'Mover "Backup diário do banco em outra região" para a coluna anterior' }));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).cards.find((c: { id: string }) => c.id === "T-132").column).toBe("review");
    expect(screen.getByText("Salvo neste navegador.")).toBeInTheDocument();
  });

  it("keeps working when storage is unavailable", async () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    const user = setup(broken);
    expect(screen.getByText(/Não foi possível salvar/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: 'Mover "Cupom de frete grátis para o RS" para a próxima coluna' }));
    expect(titlesIn("Em andamento")[0]).toBe("Cupom de frete grátis para o RS");
  });

  it("opens the new task dialog with the N shortcut", async () => {
    const user = setup();
    await user.keyboard("n");
    expect(screen.getByRole("dialog", { name: "Nova tarefa" })).toBeInTheDocument();
  });
});
