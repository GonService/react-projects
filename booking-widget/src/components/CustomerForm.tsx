import { useRef, useState, type FormEvent } from "react";
import { maskPhone, validateCustomer, type CustomerErrors } from "../format";
import type { Customer } from "../types";

interface Props {
  initial: Customer;
  submitting: boolean;
  serverError: string | null;
  onBack: () => void;
  onSubmit: (customer: Customer) => void;
}

const FIELDS: (keyof Customer)[] = ["name", "phone", "email", "notes"];

export function CustomerForm({ initial, submitting, serverError, onBack, onSubmit }: Props) {
  const [values, setValues] = useState<Customer>(initial);
  const [errors, setErrors] = useState<CustomerErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Customer, boolean>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const set = (field: keyof Customer, value: string) => {
    const next = { ...values, [field]: field === "phone" ? maskPhone(value) : value };
    setValues(next);
    if (touched[field]) setErrors(validateCustomer(next));
  };

  const blur = (field: keyof Customer) => {
    setTouched((t) => ({ ...t, [field]: true }));
    const all = validateCustomer(values);
    setErrors((e) => ({ ...e, [field]: all[field] }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateCustomer(values);
    setErrors(found);
    setTouched({ name: true, phone: true, email: true, notes: true });
    const firstInvalid = FIELDS.find((f) => found[f]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    onSubmit({ ...values, name: values.name.trim(), email: values.email.trim() });
  };

  const field = (name: keyof Customer, label: string, extra: Record<string, string> = {}, hint?: string) => {
    const error = errors[name];
    const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ") || undefined;
    const common = {
      id: name,
      name,
      value: values[name],
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy,
      onChange: (e: { target: { value: string } }) => set(name, e.target.value),
      onBlur: () => blur(name),
    };
    return (
      <div className={`field${error ? " has-error" : ""}`}>
        <label htmlFor={name}>{label}</label>
        {hint && <p id={`${name}-hint`} className="hint">{hint}</p>}
        {name === "notes" ? <textarea rows={3} {...common} /> : <input {...common} {...extra} />}
        {error && <p id={`${name}-error`} className="error">{error}</p>}
      </div>
    );
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="form">
      <div className="form-grid">
        {field("name", "Nome completo", { autoComplete: "name" })}
        {field("phone", "Celular ou telefone", { type: "tel", inputMode: "numeric", autoComplete: "tel-national", placeholder: "(51) 99876-5432" }, "Enviamos a confirmação por WhatsApp.")}
        {field("email", "E-mail", { type: "email", autoComplete: "email", placeholder: "nome@exemplo.com.br" })}
        {field("notes", "Observações (opcional)", {}, "Ex.: convênio, indicação médica, restrições.")}
      </div>
      {serverError && <p className="alert" role="alert">{serverError}</p>}
      <div className="actions">
        <button type="button" className="btn ghost" onClick={onBack}>Voltar</button>
        <button type="submit" className="btn primary" disabled={submitting}>
          {submitting ? "Confirmando…" : "Confirmar agendamento"}
        </button>
      </div>
    </form>
  );
}
