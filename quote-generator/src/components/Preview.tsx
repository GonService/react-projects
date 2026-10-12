import { computeTotals, formatBRL, formatDate, formatLongDate, formatQuantity, lineTotal, validUntil } from "../quote";
import type { Party, Quote } from "../types";

function PartyBlock({ title, party }: { title: string; party: Party }) {
  return (
    <div className="doc-party">
      <h3>{title}</h3>
      <p className="doc-party-name">{party.name || "—"}</p>
      {party.document && <p>{party.document.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF"} {party.document}</p>}
      {party.contact && <p>A/C {party.contact}</p>}
      {(party.phone || party.email) && <p>{[party.phone, party.email].filter(Boolean).join(" · ")}</p>}
      {party.address && <p>{party.address}</p>}
    </div>
  );
}

/** The A4 document. On screen it is scaled to fit; when printing it is the only thing on the page. */
export function Preview({ quote }: { quote: Quote }) {
  const totals = computeTotals(quote);
  const items = quote.items.filter((i) => i.description.trim() || i.unitPrice > 0);
  return (
    <article className="sheet" aria-label={`Pré-visualização do orçamento ${quote.number}`}>
      <header className="doc-head">
        <div>
          <p className="doc-issuer">{quote.issuer.name || "Sua empresa"}</p>
          <p className="doc-issuer-meta">{[quote.issuer.document && `CNPJ ${quote.issuer.document}`, quote.issuer.phone, quote.issuer.email].filter(Boolean).join(" · ")}</p>
          <p className="doc-issuer-meta">{quote.issuer.address}</p>
        </div>
        <div className="doc-title">
          <h2>Orçamento</h2>
          <p className="doc-number">{quote.number}</p>
        </div>
      </header>

      <dl className="doc-dates">
        <div><dt>Emissão</dt><dd>{formatDate(quote.issueDate)}</dd></div>
        <div><dt>Validade</dt><dd>{formatDate(validUntil(quote))} ({quote.validityDays} dias)</dd></div>
        <div><dt>Total</dt><dd>{formatBRL(totals.total)}</dd></div>
      </dl>

      <PartyBlock title="Cliente" party={quote.client} />

      <table className="doc-items">
        <thead>
          <tr>
            <th scope="col" className="num">#</th>
            <th scope="col">Descrição</th>
            <th scope="col" className="num">Qtd.</th>
            <th scope="col" className="num">Unitário</th>
            <th scope="col" className="num">Desc.</th>
            <th scope="col" className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr><td colSpan={6} className="doc-empty">Nenhum item.</td></tr>
          )}
          {items.map((item, i) => (
            <tr key={item.id}>
              <td className="num muted">{i + 1}</td>
              <td>{item.description || "—"}</td>
              <td className="num">{formatQuantity(item.quantity)} {item.unit}</td>
              <td className="num">{formatBRL(item.unitPrice)}</td>
              <td className="num">{item.discountPct ? `${formatQuantity(item.discountPct)}%` : "—"}</td>
              <td className="num strong">{formatBRL(lineTotal(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="doc-bottom">
        <div className="doc-terms">
          {quote.paymentTerms && (
            <>
              <h3>Condições de pagamento</h3>
              <p>{quote.paymentTerms}</p>
            </>
          )}
          {quote.notes && (
            <>
              <h3>Observações</h3>
              <p>{quote.notes}</p>
            </>
          )}
        </div>
        <table className="doc-totals" aria-label="Totais">
          <tbody>
            <tr><th scope="row">Subtotal</th><td>{formatBRL(totals.gross)}</td></tr>
            {totals.lineDiscounts > 0 && <tr><th scope="row">Descontos nos itens</th><td>− {formatBRL(totals.lineDiscounts)}</td></tr>}
            {totals.globalDiscount > 0 && <tr><th scope="row">Desconto</th><td>− {formatBRL(totals.globalDiscount)}</td></tr>}
            {quote.taxPct > 0 && <tr><th scope="row">{quote.taxLabel || "Impostos"} ({formatQuantity(quote.taxPct)}%)</th><td>{formatBRL(totals.tax)}</td></tr>}
            <tr className="grand"><th scope="row">Total</th><td>{formatBRL(totals.total)}</td></tr>
          </tbody>
        </table>
      </div>

      <footer className="doc-foot">
        <div className="doc-sign">
          <span />
          <p>{quote.issuer.contact || quote.issuer.name}</p>
          <p className="muted">{quote.issuer.name}</p>
        </div>
        <div className="doc-sign">
          <span />
          <p>De acordo — {quote.client.contact || quote.client.name || "cliente"}</p>
          <p className="muted">Data: ____/____/______</p>
        </div>
      </footer>
      <p className="doc-legal">Orçamento emitido em {formatLongDate(quote.issueDate)}. Valores em reais (R$). Proposta válida até {formatDate(validUntil(quote))}.</p>
    </article>
  );
}
