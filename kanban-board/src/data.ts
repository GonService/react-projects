import type { Board, Card, Column, Label, Person } from "./types";

export const columns: Column[] = [
  { id: "backlog", title: "A fazer" },
  { id: "doing", title: "Em andamento", wipLimit: 4 },
  { id: "review", title: "Em revisão", wipLimit: 3 },
  { id: "done", title: "Concluído" },
];

export const labels: Label[] = [
  { id: "front", name: "Front-end", color: "#2f6fd6" },
  { id: "back", name: "Back-end", color: "#7a4fc4" },
  { id: "infra", name: "Infra", color: "#0f7f74" },
  { id: "bug", name: "Bug", color: "#c2362b" },
  { id: "design", name: "Design", color: "#b0558f" },
  { id: "suporte", name: "Suporte", color: "#9a6a00" },
];

export const people: Person[] = [
  { id: "rafa", name: "Rafaela Moura" },
  { id: "lucas", name: "Lucas Bertoldi" },
  { id: "carla", name: "Carla Nunes" },
  { id: "thiago", name: "Thiago Sperb" },
  { id: "bia", name: "Beatriz Lima" },
];

function shift(today: string, days: number): string {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Demo board for the e-commerce team of a regional retailer. Due dates are relative to today. */
export function demoBoard(today: string): Board {
  const c = (id: number, column: Card["column"], title: string, description: string, labelIds: string[], assignee: string | null, dueIn: number | null): Card => ({
    id: `T-${id}`,
    title,
    description,
    column,
    labels: labelIds,
    assignee,
    due: dueIn === null ? null : shift(today, dueIn),
    createdAt: shift(today, -10 + (id % 7)),
  });
  const cards = [
    c(101, "backlog", "Cupom de frete grátis para o RS", "Regra no checkout: pedidos acima de R$ 199 com CEP 90000-000 a 99999-999.", ["back", "front"], "lucas", 6),
    c(102, "backlog", "Página de troca e devolução", "Texto revisado pelo jurídico, formulário com número do pedido.", ["front", "design"], "bia", 9),
    c(103, "backlog", "Alerta de estoque baixo no Slack", "Avisar o canal #compras quando um SKU ficar com menos de 5 unidades.", ["back", "infra"], null, null),
    c(104, "backlog", "Atualizar imagem base do Node para 22", "Dockerfiles da API e do worker de notas fiscais.", ["infra"], "thiago", 14),
    c(105, "backlog", "Pesquisa de satisfação pós-entrega", "Disparo por e-mail 3 dias após a entrega, nota de 0 a 10.", ["back"], null, null),
    c(111, "doing", "Integração Pix com conciliação automática", "Webhook do banco marca o pedido como pago; fila para reprocessar falhas.", ["back"], "rafa", 2),
    c(112, "doing", "Erro 500 ao aplicar cupom expirado", "Chamado #4821. Retornar mensagem amigável em vez de erro.", ["bug", "back"], "lucas", -1),
    c(113, "doing", "Filtro por tamanho na vitrine mobile", "Chips roláveis horizontalmente, estado na URL.", ["front"], "carla", 0),
    c(121, "review", "Cálculo de frete com a nova tabela dos Correios", "Testes com CEPs de capital e interior.", ["back"], "rafa", 1),
    c(122, "review", "Alertas de latência no Datadog", "p95 do checkout acima de 800 ms por 10 min abre incidente.", ["infra"], "thiago", -3),
    c(123, "review", "Responder clientes sobre atraso na Serra", "Modelo de mensagem para o atendimento usar no WhatsApp.", ["suporte"], "bia", 0),
    c(131, "done", "Banner da Semana do Cliente", "", ["design", "front"], "carla", -4),
    c(132, "done", "Backup diário do banco em outra região", "Retenção de 30 dias, teste de restauração documentado.", ["infra"], "thiago", -6),
    c(133, "done", "Nota fiscal com CFOP correto para SC", "", ["bug", "back"], "lucas", -2),
  ];
  return { version: 1, cards, nextId: 140 };
}
