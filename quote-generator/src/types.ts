export interface Party {
  name: string;
  /** CPF or CNPJ, formatted. */
  document: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
}

export interface LineItem {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  /** Unit price in cents. */
  unitPrice: number;
  /** Line discount in percent (0-100). */
  discountPct: number;
}

export interface Quote {
  version: 1;
  number: string;
  /** "YYYY-MM-DD" */
  issueDate: string;
  validityDays: number;
  issuer: Party;
  client: Party;
  items: LineItem[];
  /** Discount on the whole quote, in cents. */
  globalDiscount: number;
  taxLabel: string;
  /** Tax added on top of the discounted total, in percent. */
  taxPct: number;
  paymentTerms: string;
  notes: string;
}

export interface Totals {
  gross: number;
  lineDiscounts: number;
  itemsTotal: number;
  globalDiscount: number;
  taxBase: number;
  tax: number;
  total: number;
}

export interface Draft {
  id: string;
  savedAt: string;
  quote: Quote;
}
