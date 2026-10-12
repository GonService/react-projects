import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { DecimalInput, MoneyInput } from "./components/Inputs";
import { Download, Down, Plus, Printer, Save, Trash, Up, Upload } from "./components/Icons";
import { Preview } from "./components/Preview";
import { demoIssuer, demoQuote, UNITS } from "./data";
import {
  computeTotals,
  documentError,
  emptyItem,
  exportJson,
  formatBRL,
  formatDate,
  lineTotal,
  loadDrafts,
  maskDocument,
  nextNumber,
  parseQuote,
  quoteProblems,
  safeStorage,
  storeDrafts,
  toISODate,
  upsertDraft,
  validUntil,
} from "./quote";
import type { Draft, LineItem, Party, Quote } from "./types";

interface Props {
  now?: Date;
  /** Storage for drafts; null disables it. */
  storage?: Storage | null;
}

const PARTY_FIELDS: { key: keyof Party; label: string; type?: string; autoComplete?: string; wide?: boolean }[] = [
  { key: "name", label: "Nome ou razão social", autoComplete: "organization", wide: true },
  { key: "document", label: "CPF ou CNPJ" },
  { key: "contact", label: "Contato", autoComplete: "name" },
  { key: "email", label: "E-mail", type: "email", autoComplete: "email" },
  { key: "phone", label: "Telefone", type: "tel", autoComplete: "tel" },
  { key: "address", label: "Endereço", autoComplete: "street-address", wide: true },
];

/** FileReader works everywhere, including older Safari versions without Blob.text(). */
function readText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function PartyFields({ prefix, party, onChange }: { prefix: string; party: Party; onChange: (p: Party) => void }) {
  const [touchedDoc, setTouchedDoc] = useState(false);
  const docError = touchedDoc ? documentError(party.document) : null;
  return (
    <div className="grid">
      {PARTY_FIELDS.map((f) => {
        const id = `${prefix}-${f.key}`;
        const isDoc = f.key === "document";
        return (
          <div key={f.key} className={`field${f.wide ? " wide" : ""}`}>
            <label htmlFor={id}>{f.label}</label>
            <input
              id={id}
              type={f.type ?? "text"}
              inputMode={isDoc ? "numeric" : undefined}
              autoComplete={f.autoComplete}
              value={party[f.key]}
              aria-invalid={isDoc && docError ? true : undefined}
              aria-describedby={isDoc && docError ? `${id}-error` : undefined}
              onBlur={isDoc ? () => setTouchedDoc(true) : undefined}
              onChange={(e) => onChange({ ...party, [f.key]: isDoc ? maskDocument(e.target.value) : e.target.value })}
            />
            {isDoc && docError && <p id={`${id}-error`} className="error">{docError}</p>}
          </div>
        );
      })}
    </div>
  );
}

export default function App({ now: nowProp, storage: storageProp }: Props) {
  const today = useMemo(() => toISODate(nowProp ?? new Date()), [nowProp]);
  const storage = storageProp === null ? undefined : (storageProp ?? safeStorage());
  const [quote, setQuote] = useState<Quote>(() => demoQuote(today));
  const [drafts, setDrafts] = useState<Draft[]>(() => loadDrafts(storage));
  const [message, setMessage] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const fileRef = useRef<HTMLInputElement>(null);
  const previewBox = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(1123);

  const totals = computeTotals(quote);
  const set = <K extends keyof Quote>(key: K, value: Quote[K]) => setQuote((q) => ({ ...q, [key]: value }));
  const setItem = (id: string, patch: Partial<LineItem>) =>
    setQuote((q) => ({ ...q, items: q.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  // Scale the 210 mm sheet to the width of the preview column.
  useLayoutEffect(() => {
    const el = previewBox.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setScale(Math.min(1, el.clientWidth / 794));
      if (sheetRef.current) setSheetHeight(sheetRef.current.offsetHeight);
    });
    ro.observe(el);
    if (sheetRef.current) ro.observe(sheetRef.current);
    return () => ro.disconnect();
  }, [pane]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const addItem = () => {
    const item = emptyItem();
    setQuote((q) => ({ ...q, items: [...q.items, item] }));
    requestAnimationFrame(() => document.getElementById(`desc-${item.id}`)?.focus());
  };

  const removeItem = (index: number) => {
    const item = quote.items[index];
    if (!item) return;
    setQuote((q) => ({ ...q, items: q.items.filter((i) => i.id !== item.id) }));
    setMessage(`Item ${index + 1} removido.`);
    const next = quote.items[index + 1] ?? quote.items[index - 1];
    requestAnimationFrame(() => (next ? document.getElementById(`desc-${next.id}`) : document.getElementById("add-item"))?.focus());
  };

  const moveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= quote.items.length) return;
    const items = [...quote.items];
    [items[index], items[target]] = [items[target]!, items[index]!];
    set("items", items);
    setMessage(`Item movido para a posição ${target + 1}.`);
  };

  const saveDraft = () => {
    const next = upsertDraft(drafts, quote, new Date().toISOString());
    setDrafts(next);
    setMessage(storeDrafts(storage, next) ? `Rascunho ${quote.number} salvo neste navegador.` : "Não foi possível salvar no navegador. Use Exportar JSON para guardar o orçamento.");
  };

  const openDraft = (d: Draft) => {
    setQuote(d.quote);
    setProblems([]);
    setPane("edit");
    setMessage(`Rascunho ${d.quote.number} aberto.`);
  };

  const deleteDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    storeDrafts(storage, next);
    setMessage(`Rascunho ${id} excluído.`);
  };

  const newQuote = () => {
    setQuote({
      ...demoQuote(today),
      number: nextNumber(today, drafts),
      client: { name: "", document: "", contact: "", email: "", phone: "", address: "" },
      issuer: quote.issuer.name ? quote.issuer : demoIssuer,
      items: [emptyItem()],
      globalDiscount: 0,
      notes: "",
    });
    setProblems([]);
    setPane("edit");
    setMessage("Novo orçamento em branco.");
    requestAnimationFrame(() => document.getElementById("client-name")?.focus());
  };

  const download = () => {
    const blob = new Blob([exportJson(quote)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quote.number}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`${quote.number}.json exportado.`);
  };

  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = parseQuote(JSON.parse(await readText(file)));
      if (!parsed) throw new Error("invalid");
      setQuote(parsed);
      setProblems([]);
      setMessage(`Orçamento ${parsed.number} importado.`);
    } catch {
      setMessage("Arquivo inválido: use um JSON exportado por este gerador.");
    }
  };

  const print = () => {
    const found = quoteProblems(quote);
    setProblems(found);
    if (found.length) {
      requestAnimationFrame(() => document.getElementById("problems")?.focus());
      return;
    }
    window.print();
  };

  return (
    <div className="app" data-pane={pane}>
      <header className="appbar">
        <div className="appbar-title">
          <h1>Orçamentos</h1>
          <p>{quote.number} · {formatBRL(totals.total)}</p>
        </div>
        <div className="appbar-actions">
          <button type="button" className="btn" onClick={newQuote}><Plus /> Novo</button>
          <button type="button" className="btn" onClick={saveDraft}><Save /> Salvar rascunho</button>
          <button type="button" className="btn" onClick={download}><Download /> Exportar JSON</button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}><Upload /> Importar</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} aria-label="Importar arquivo JSON" />
          <button type="button" className="btn primary" onClick={print}><Printer /> Imprimir / PDF</button>
        </div>
      </header>

      <div className="pane-switch" role="group" aria-label="Exibir">
        <button type="button" aria-pressed={pane === "edit"} onClick={() => setPane("edit")}>Editar</button>
        <button type="button" aria-pressed={pane === "preview"} onClick={() => setPane("preview")}>Visualizar</button>
      </div>

      <div className="status" role="status" aria-live="polite">{message}</div>

      <div className="layout">
        <main className="editor">
          {problems.length > 0 && (
            <div id="problems" className="problems" tabIndex={-1} role="alert">
              <p>Antes de imprimir, corrija:</p>
              <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}

          <section className="panel" aria-labelledby="h-meta">
            <h2 id="h-meta">Orçamento</h2>
            <div className="grid">
              <div className="field">
                <label htmlFor="q-number">Número</label>
                <input id="q-number" value={quote.number} onChange={(e) => set("number", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="q-date">Emissão</label>
                <input id="q-date" type="date" value={quote.issueDate} onChange={(e) => e.target.value && set("issueDate", e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="q-validity">Validade (dias)</label>
                <input id="q-validity" type="number" min={1} max={365} value={quote.validityDays} aria-describedby="q-validity-hint"
                  onChange={(e) => set("validityDays", Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
                <p id="q-validity-hint" className="hint">Válido até {formatDate(validUntil(quote))}</p>
              </div>
            </div>
          </section>

          <section className="panel" aria-labelledby="h-client">
            <h2 id="h-client">Cliente</h2>
            <PartyFields prefix="client" party={quote.client} onChange={(p) => set("client", p)} />
          </section>

          <section className="panel" aria-labelledby="h-items">
            <h2 id="h-items">Itens</h2>
            <div className="items" role="list">
              {quote.items.map((item, i) => (
                <div className="item" role="listitem" key={item.id} aria-label={`Item ${i + 1}`}>
                  <label className="cell desc">
                    <span className="cell-label">Descrição</span>
                    <input id={`desc-${item.id}`} value={item.description} aria-label={`Descrição do item ${i + 1}`} placeholder="Serviço ou produto"
                      onChange={(e) => setItem(item.id, { description: e.target.value })} />
                  </label>
                  <label className="cell">
                    <span className="cell-label">Unid.</span>
                    <select value={item.unit} aria-label={`Unidade do item ${i + 1}`} onChange={(e) => setItem(item.id, { unit: e.target.value })}>
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </label>
                  <label className="cell">
                    <span className="cell-label">Qtd.</span>
                    <DecimalInput value={item.quantity} min={0} max={1_000_000} aria-label={`Quantidade do item ${i + 1}`} onValue={(n) => setItem(item.id, { quantity: n })} />
                  </label>
                  <label className="cell">
                    <span className="cell-label">Unitário (R$)</span>
                    <MoneyInput cents={item.unitPrice} aria-label={`Valor unitário do item ${i + 1}`} onCents={(c) => setItem(item.id, { unitPrice: c })} />
                  </label>
                  <label className="cell">
                    <span className="cell-label">Desc. %</span>
                    <DecimalInput value={item.discountPct} min={0} max={100} aria-label={`Desconto do item ${i + 1} em porcentagem`} onValue={(n) => setItem(item.id, { discountPct: n })} />
                  </label>
                  <output className="cell num line-total" aria-label={`Total do item ${i + 1}`}>{formatBRL(lineTotal(item))}</output>
                  <div className="cell row-actions">
                    <button type="button" className="icon-btn" onClick={() => moveItem(i, -1)} disabled={i === 0} aria-label={`Subir item ${i + 1}`}><Up /></button>
                    <button type="button" className="icon-btn" onClick={() => moveItem(i, 1)} disabled={i === quote.items.length - 1} aria-label={`Descer item ${i + 1}`}><Down /></button>
                    <button type="button" className="icon-btn danger" onClick={() => removeItem(i)} aria-label={`Remover item ${i + 1}`}><Trash /></button>
                  </div>
                </div>
              ))}
            </div>
            <button id="add-item" type="button" className="btn add" onClick={addItem}><Plus /> Adicionar item</button>
          </section>

          <section className="panel" aria-labelledby="h-values">
            <h2 id="h-values">Valores e condições</h2>
            <div className="values">
              <div className="grid">
                <div className="field">
                  <label htmlFor="q-discount">Desconto geral (R$)</label>
                  <MoneyInput id="q-discount" cents={quote.globalDiscount} onCents={(c) => set("globalDiscount", c)} />
                </div>
                <div className="field">
                  <label htmlFor="q-tax-label">Imposto</label>
                  <input id="q-tax-label" value={quote.taxLabel} onChange={(e) => set("taxLabel", e.target.value)} placeholder="ISS" />
                </div>
                <div className="field">
                  <label htmlFor="q-tax">Alíquota (%)</label>
                  <DecimalInput id="q-tax" value={quote.taxPct} min={0} max={100} onValue={(n) => set("taxPct", n)} />
                </div>
                <div className="field wide">
                  <label htmlFor="q-payment">Condições de pagamento</label>
                  <input id="q-payment" value={quote.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />
                </div>
                <div className="field wide">
                  <label htmlFor="q-notes">Observações</label>
                  <textarea id="q-notes" rows={3} value={quote.notes} onChange={(e) => set("notes", e.target.value)} />
                </div>
              </div>
              <dl className="totals" aria-label="Resumo dos valores">
                <div><dt>Subtotal</dt><dd>{formatBRL(totals.gross)}</dd></div>
                <div><dt>Descontos</dt><dd>− {formatBRL(totals.lineDiscounts + totals.globalDiscount)}</dd></div>
                <div><dt>{quote.taxLabel || "Impostos"}</dt><dd>{formatBRL(totals.tax)}</dd></div>
                <div className="grand"><dt>Total</dt><dd>{formatBRL(totals.total)}</dd></div>
              </dl>
            </div>
          </section>

          <details className="panel">
            <summary><h2>Sua empresa</h2><span className="muted">{quote.issuer.name}</span></summary>
            <PartyFields prefix="issuer" party={quote.issuer} onChange={(p) => set("issuer", p)} />
          </details>

          <section className="panel" aria-labelledby="h-drafts">
            <h2 id="h-drafts">Rascunhos salvos</h2>
            {drafts.length === 0 ? (
              <p className="muted">Nenhum rascunho ainda. "Salvar rascunho" guarda o orçamento neste navegador.</p>
            ) : (
              <ul className="drafts">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <div>
                      <strong>{d.quote.number}</strong> · {d.quote.client.name || "sem cliente"}
                      <span className="muted"> · {formatBRL(computeTotals(d.quote).total)} · salvo {new Date(d.savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    <div className="draft-actions">
                      <button type="button" className="btn small" onClick={() => openDraft(d)} aria-label={`Abrir rascunho ${d.quote.number}`}>Abrir</button>
                      <button type="button" className="btn small" onClick={() => deleteDraft(d.id)} aria-label={`Excluir rascunho ${d.quote.number}`}>Excluir</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        <aside className="preview" aria-label="Pré-visualização A4">
          <div className="preview-box" ref={previewBox}>
            <div className="sheet-frame" style={{ height: `${sheetHeight * scale}px` }}>
              <div className="sheet-scale" ref={sheetRef} style={{ transform: `scale(${scale})` }}>
                <Preview quote={quote} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
