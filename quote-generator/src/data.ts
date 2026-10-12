import { newItemId } from "./quote";
import type { Party, Quote } from "./types";

export const demoIssuer: Party = {
  name: "Serra Climatização e Elétrica Ltda.",
  document: "11.444.777/0001-61",
  contact: "Fernanda Zanella",
  email: "orcamentos@serraclima.com.br",
  phone: "(54) 3221-4080",
  address: "Rua Sinimbu, 1450 · Centro · Caxias do Sul/RS · CEP 95020-002",
};

export function demoQuote(issueDate: string): Quote {
  return {
    version: 1,
    number: "ORC-2026-0142",
    issueDate,
    validityDays: 15,
    issuer: demoIssuer,
    client: {
      name: "Padaria Pão Dourado Ltda.",
      document: "45.723.174/0001-10",
      contact: "Marcos Tonietto",
      email: "compras@paodourado.com.br",
      phone: "(54) 99134-2210",
      address: "Av. Júlio de Castilhos, 2210 · Caxias do Sul/RS",
    },
    items: [
      { id: newItemId(), description: "Ar-condicionado split inverter 24.000 BTUs (equipamento)", unit: "un", quantity: 2, unitPrice: 489_900, discountPct: 5 },
      { id: newItemId(), description: "Instalação de split até 3 m de tubulação", unit: "un", quantity: 2, unitPrice: 75_000, discountPct: 0 },
      { id: newItemId(), description: "Tubulação de cobre adicional com isolamento", unit: "m", quantity: 6.5, unitPrice: 9_800, discountPct: 0 },
      { id: newItemId(), description: "Circuito elétrico dedicado com disjuntor", unit: "un", quantity: 2, unitPrice: 42_000, discountPct: 0 },
      { id: newItemId(), description: "Limpeza e higienização das câmaras frias", unit: "h", quantity: 4, unitPrice: 14_500, discountPct: 10 },
    ],
    globalDiscount: 20_000,
    taxLabel: "ISS",
    taxPct: 3,
    paymentTerms: "50% na aprovação e 50% na conclusão, via Pix ou boleto.",
    notes: "Instalação em até 5 dias úteis após a aprovação. Garantia de 12 meses para o serviço e conforme fabricante para os equipamentos. Não inclui obras de alvenaria.",
  };
}

export const UNITS = ["un", "h", "m", "m²", "kg", "serviço", "mês"];
