import { useEffect, useMemo, useRef, useState } from "react";
import { defaultApi, SlotTakenError, type BookingApi } from "./api";
import { Calendar } from "./components/Calendar";
import { CustomerForm } from "./components/CustomerForm";
import { business } from "./config";
import { buildIcs, endTime, formatDuration, formatLongDate, formatPrice } from "./format";
import { addDays, availableSlots, groupSlots, isOpenDay, lastBookableDate, parseISODate, toISODate } from "./slots";
import type { Busy, Confirmation, Customer, Service } from "./types";

type Step = "service" | "when" | "details" | "done";

const STEPS: { id: Step; label: string }[] = [
  { id: "service", label: "Serviço" },
  { id: "when", label: "Data e horário" },
  { id: "details", label: "Seus dados" },
  { id: "done", label: "Confirmação" },
];

const EMPTY_CUSTOMER: Customer = { name: "", phone: "", email: "", notes: "" };

interface Props {
  api?: BookingApi;
  /** Fixed clock for tests and screenshots. */
  now?: Date;
}

export default function App({ api: apiProp, now: nowProp }: Props) {
  const api = useMemo(() => apiProp ?? defaultApi(), [apiProp]);
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const today = toISODate(now);
  const lastDay = lastBookableDate(now, business.maxDaysAhead);

  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<Service[] | null>(null);
  const [busy, setBusy] = useState<Busy[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const load = () => {
    setLoadError(null);
    Promise.all([api.listServices(), api.listBusy(today, lastDay)])
      .then(([s, b]) => {
        setServices(s);
        setBusy(b);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(load, [api, today, lastDay]);

  // Move focus to the step heading so screen reader and keyboard users follow the flow.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const service = services?.find((s) => s.id === serviceId) ?? null;

  const slotsFor = (d: string): string[] =>
    service && busy ? availableSlots({ date: d, durationMin: service.durationMin, config: business, busy, now }) : [];

  const isAvailable = (d: string) => isOpenDay(d, business, now) && slotsFor(d).length > 0;
  const daySlots = date ? slotsFor(date) : [];

  const monthIndex = view.year * 12 + view.month;
  const firstMonth = now.getFullYear() * 12 + now.getMonth();
  const last = parseISODate(lastDay);
  const lastMonth = last.getFullYear() * 12 + last.getMonth();

  const chooseService = (id: string) => {
    setServiceId(id);
    setTime(null);
    // Keep the chosen day only if it still has room for the new service.
    const next = services?.find((s) => s.id === id);
    if (date && next && busy && availableSlots({ date, durationMin: next.durationMin, config: business, busy, now }).length === 0) {
      setDate(null);
    }
    setStep("when");
  };

  const pickFirstAvailable = () => {
    for (let d = today; d <= lastDay; d = addDays(d, 1)) {
      if (isAvailable(d)) {
        const p = parseISODate(d);
        setView({ year: p.getFullYear(), month: p.getMonth() });
        setDate(d);
        setTime(null);
        return;
      }
    }
  };

  const submit = async (c: Customer) => {
    if (!service || !date || !time) return;
    setCustomer(c);
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await api.book({ serviceId: service.id, date, start: time, customer: c });
      setConfirmation(result);
      setBusy((b) => [...(b ?? []), { date, start: time, durationMin: service.durationMin }]);
      setStep("done");
      if (window.parent !== window) {
        // Lets the host page react (close a modal, track a conversion). No personal data is sent.
        window.parent.postMessage({ type: "booking:confirmed", code: result.code, serviceId: service.id, date, start: time }, "*");
      }
    } catch (e) {
      if (e instanceof SlotTakenError) {
        setBusy((b) => [...(b ?? []), { date, start: time, durationMin: service.durationMin }]);
        setTime(null);
        setStep("when");
      }
      setServerError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setStep("service");
    setServiceId(null);
    setDate(null);
    setTime(null);
    setCustomer(EMPTY_CUSTOMER);
    setConfirmation(null);
    setServerError(null);
  };

  const icsHref = useMemo(() => {
    if (!confirmation || !service) return null;
    const ics = buildIcs({
      code: confirmation.code,
      title: `${service.name} · ${business.name}`,
      date: confirmation.date,
      start: confirmation.start,
      durationMin: service.durationMin,
      location: business.address,
    });
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, [confirmation, service]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <main className="widget">
      <header className="widget-head">
        <div>
          <p className="eyebrow">Agendamento online</p>
          <h1>{business.name}</h1>
          <p className="address">{business.address}</p>
        </div>
        {api.mode === "demo" && <span className="badge" title="Dados de demonstração; nenhum agendamento real é feito">Demonstração</span>}
      </header>

      <ol className="steps" aria-label="Etapas do agendamento">
        {STEPS.map((s, i) => (
          <li key={s.id} data-state={i < stepIndex ? "done" : i === stepIndex ? "current" : "todo"} aria-current={i === stepIndex ? "step" : undefined}>
            <span className="step-num" aria-hidden="true">{i + 1}</span>
            <span className="step-label">{s.label}</span>
          </li>
        ))}
      </ol>

      {loadError && (
        <div className="alert" role="alert">
          <p>Não foi possível carregar a agenda. {loadError}</p>
          <button type="button" className="btn ghost" onClick={load}>Tentar de novo</button>
        </div>
      )}

      {!loadError && (!services || !busy) && <p className="loading" role="status">Carregando agenda…</p>}

      {services && busy && step === "service" && (
        <section aria-labelledby="step-title">
          <h2 id="step-title" ref={headingRef} tabIndex={-1}>Qual atendimento você procura?</h2>
          <ul className="services">
            {services.map((s) => (
              <li key={s.id}>
                <button type="button" className="service" aria-pressed={s.id === serviceId} onClick={() => chooseService(s.id)}>
                  <span className="service-name">{s.name}</span>
                  <span className="service-desc">{s.description}</span>
                  <span className="service-meta">
                    <span>{formatDuration(s.durationMin)}</span>
                    <span>{formatPrice(s.priceCents)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {services && busy && service && step === "when" && (
        <section aria-labelledby="step-title">
          <div className="section-head">
            <h2 id="step-title" ref={headingRef} tabIndex={-1}>Escolha o dia e o horário</h2>
            <button type="button" className="link" onClick={() => setStep("service")}>
              Trocar serviço
            </button>
          </div>
          <p className="chosen">
            <strong>{service.name}</strong> · {formatDuration(service.durationMin)} · {formatPrice(service.priceCents)}
          </p>
          {serverError && <p className="alert" role="alert">{serverError}</p>}
          <div className="when">
            <Calendar
              year={view.year}
              month={view.month}
              today={today}
              selected={date}
              isAvailable={isAvailable}
              canPrev={monthIndex > firstMonth}
              canNext={monthIndex < lastMonth}
              onMonthChange={(delta) => {
                const m = monthIndex + delta;
                setView({ year: Math.floor(m / 12), month: m % 12 });
              }}
              onSelect={(d) => {
                setDate(d);
                setTime(null);
                setServerError(null);
              }}
            />
            <div className="slots" aria-live="polite">
              {!date && (
                <div className="slots-empty">
                  <p>Selecione um dia no calendário para ver os horários livres.</p>
                  <button type="button" className="btn ghost" onClick={pickFirstAvailable}>Primeiro dia disponível</button>
                </div>
              )}
              {date && (
                <>
                  <h3>{formatLongDate(date)}</h3>
                  {daySlots.length === 0 && <p className="muted">Sem horários livres neste dia.</p>}
                  {groupSlots(daySlots).map((g) => (
                    <div key={g.label} className="slot-group" role="group" aria-label={g.label}>
                      <h4>{g.label}</h4>
                      <div className="slot-list">
                        {g.slots.map((s) => (
                          <button key={s} type="button" className="slot" aria-pressed={s === time} onClick={() => setTime(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn ghost" onClick={() => setStep("service")}>Voltar</button>
            <button
              type="button"
              className="btn primary"
              disabled={!date || !time}
              onClick={() => {
                setServerError(null);
                setStep("details");
              }}
            >
              {date && time ? `Continuar com ${time}` : "Escolha um horário"}
            </button>
          </div>
        </section>
      )}

      {service && date && time && step === "details" && (
        <section aria-labelledby="step-title">
          <h2 id="step-title" ref={headingRef} tabIndex={-1}>Seus dados</h2>
          <p className="chosen">
            <strong>{service.name}</strong> · {formatLongDate(date)}, {time} às {endTime(time, service.durationMin)}
          </p>
          <CustomerForm initial={customer} submitting={submitting} serverError={serverError} onBack={() => setStep("when")} onSubmit={submit} />
        </section>
      )}

      {service && confirmation && step === "done" && (
        <section aria-labelledby="step-title" className="done">
          <svg className="check" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r="22" />
            <path d="m14 25 7 7 13-15" />
          </svg>
          <h2 id="step-title" ref={headingRef} tabIndex={-1}>Agendamento confirmado</h2>
          <p>
            Obrigado, {confirmation.customer.name.split(" ")[0]}. Enviamos os detalhes para <strong>{confirmation.customer.email}</strong>.
          </p>
          <dl className="receipt">
            <div><dt>Código</dt><dd className="code">{confirmation.code}</dd></div>
            <div><dt>Serviço</dt><dd>{service.name}</dd></div>
            <div><dt>Quando</dt><dd>{formatLongDate(confirmation.date)}, {confirmation.start} às {endTime(confirmation.start, service.durationMin)}</dd></div>
            <div><dt>Onde</dt><dd>{business.address}</dd></div>
            <div><dt>Valor</dt><dd>{formatPrice(service.priceCents)} (pagamento no local)</dd></div>
          </dl>
          <p className="muted small">Para remarcar ou cancelar, responda o e-mail de confirmação com até 24 horas de antecedência.</p>
          <div className="actions">
            {icsHref && (
              <a className="btn ghost" href={icsHref} download={`agendamento-${confirmation.code}.ics`}>
                Adicionar à agenda
              </a>
            )}
            <button type="button" className="btn primary" onClick={restart}>Novo agendamento</button>
          </div>
        </section>
      )}

      <footer className="widget-foot">
        Horários no fuso de Brasília · antecedência mínima de {business.leadMin / 60} h
      </footer>
    </main>
  );
}
