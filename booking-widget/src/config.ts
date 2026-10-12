import type { BusinessConfig, Service } from "./types";

/** Demo business. Replace with your own data or serve it from the API. */
export const business: BusinessConfig = {
  name: "Clínica Movimento Fisioterapia",
  address: "Rua Padre Chagas, 300 · Moinhos de Vento, Porto Alegre",
  hours: {
    0: [],
    1: [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "19:00" }],
    2: [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "19:00" }],
    3: [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "19:00" }],
    4: [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "20:00" }],
    5: [{ start: "08:00", end: "12:00" }, { start: "13:30", end: "18:00" }],
    6: [{ start: "08:00", end: "12:00" }],
  },
  stepMin: 30,
  leadMin: 120,
  maxDaysAhead: 45,
  closedDates: ["2026-11-02", "2026-11-20", "2026-12-24", "2026-12-25", "2026-12-31", "2027-01-01"],
};

export const services: Service[] = [
  {
    id: "avaliacao",
    name: "Avaliação fisioterapêutica",
    description: "Primeira consulta: histórico, testes e plano de tratamento.",
    durationMin: 60,
    priceCents: 18000,
  },
  {
    id: "sessao",
    name: "Sessão de fisioterapia",
    description: "Atendimento individual para pacientes em tratamento.",
    durationMin: 50,
    priceCents: 14000,
  },
  {
    id: "pilates",
    name: "Pilates clínico",
    description: "Aula individual com aparelhos, orientada por fisioterapeuta.",
    durationMin: 50,
    priceCents: 12000,
  },
  {
    id: "drenagem",
    name: "Drenagem linfática",
    description: "Técnica manual para pós-operatório e retenção de líquidos.",
    durationMin: 60,
    priceCents: 15000,
  },
  {
    id: "acupuntura",
    name: "Acupuntura",
    description: "Sessão para dor crônica e tensão muscular.",
    durationMin: 40,
    priceCents: 13000,
  },
];
