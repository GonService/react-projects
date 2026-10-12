import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createDemoApi } from "./api";
import App from "./App";

// Monday 12 Oct 2026, 08:00 local time.
const NOW = new Date(2026, 9, 12, 8, 0);

function setup() {
  render(<App api={createDemoApi(0)} now={NOW} />);
  return userEvent.setup();
}

async function goToSlots(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Sessão de fisioterapia/ }));
  await user.click(screen.getByRole("button", { name: "Primeiro dia disponível" }));
  const firstSlot = within(screen.getAllByRole("group", { name: /Manhã|Tarde|Noite/ })[0]!).getAllByRole("button")[0]!;
  await user.click(firstSlot);
  return firstSlot.textContent!;
}

describe("Booking widget", () => {
  it("lists services with duration and price", async () => {
    setup();
    const service = await screen.findByRole("button", { name: /Avaliação fisioterapêutica/ });
    expect(service).toHaveTextContent("1 h");
    expect(service).toHaveTextContent(/R\$\s180,00/);
    expect(screen.getByText("Demonstração")).toBeInTheDocument();
  });

  it("disables Sundays and past days in the calendar", async () => {
    const user = setup();
    await user.click(await screen.findByRole("button", { name: /Pilates clínico/ }));
    expect(screen.getByRole("button", { name: /domingo, 18 de outubro, indisponível/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /sábado, 10 de outubro, indisponível/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mês anterior" })).toBeDisabled();
  });

  it("moves between days with the arrow keys", async () => {
    const user = setup();
    await user.click(await screen.findByRole("button", { name: /Pilates clínico/ }));
    const day = screen.getByRole("button", { name: /segunda-feira, 12 de outubro/ });
    day.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: /terça-feira, 13 de outubro/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: /terça-feira, 20 de outubro/ })).toHaveFocus();
  });

  it("validates the form and shows the confirmation", async () => {
    const user = setup();
    const time = await goToSlots(user);
    await user.click(screen.getByRole("button", { name: `Continuar com ${time}` }));
    expect(screen.getByRole("heading", { name: "Seus dados" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    expect(screen.getByText("Informe seu nome.")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome completo")).toHaveFocus();

    await user.type(screen.getByLabelText("Nome completo"), "Juliana Becker");
    await user.type(screen.getByLabelText("Celular ou telefone"), "51998765432");
    expect(screen.getByLabelText("Celular ou telefone")).toHaveValue("(51) 99876-5432");
    await user.type(screen.getByLabelText("E-mail"), "juliana@exemplo");
    await user.click(screen.getByRole("button", { name: "Confirmar agendamento" }));
    expect(screen.getByText(/E-mail inválido/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("E-mail"), ".com.br");
    await user.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    expect(await screen.findByRole("heading", { name: "Agendamento confirmado" })).toBeInTheDocument();
    expect(screen.getByText(/^MOV-/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${time} às`))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adicionar à agenda" })).toHaveAttribute("download");
  });

  it("returns to the slots when the time was taken meanwhile", async () => {
    const api = createDemoApi(0);
    render(<App api={api} now={NOW} />);
    const user = userEvent.setup();
    const time = await goToSlots(user);
    const date = screen.getByRole("button", { pressed: true, name: /outubro/ }).dataset.date!;
    // Someone else books the same slot first.
    await api.book({ serviceId: "sessao", date, start: time, customer: { name: "Outra Pessoa", phone: "", email: "x@y.com", notes: "" } });

    await user.click(screen.getByRole("button", { name: `Continuar com ${time}` }));
    await user.type(screen.getByLabelText("Nome completo"), "Juliana Becker");
    await user.type(screen.getByLabelText("Celular ou telefone"), "51998765432");
    await user.type(screen.getByLabelText("E-mail"), "juliana@exemplo.com.br");
    await user.click(screen.getByRole("button", { name: "Confirmar agendamento" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/acabou de ser reservado/);
    expect(screen.getByRole("heading", { name: "Escolha o dia e o horário" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: time, pressed: true })).not.toBeInTheDocument();
  });
});
