export interface Service {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
}

/** Opening interval in "HH:MM", e.g. { start: "08:00", end: "12:00" }. */
export interface Interval {
  start: string;
  end: string;
}

/** Opening intervals per weekday, 0 = Sunday ... 6 = Saturday. */
export type WeeklyHours = Record<number, Interval[]>;

export interface BusinessConfig {
  name: string;
  address: string;
  hours: WeeklyHours;
  /** Granularity of the slot grid, in minutes. */
  stepMin: number;
  /** Minimum notice before an appointment, in minutes. */
  leadMin: number;
  /** How far ahead customers can book, in days. */
  maxDaysAhead: number;
  /** Dates (YYYY-MM-DD) when the business is closed, e.g. holidays. */
  closedDates: string[];
}

/** An existing appointment that blocks the calendar. */
export interface Busy {
  date: string;
  start: string;
  durationMin: number;
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export interface BookingRequest {
  serviceId: string;
  date: string;
  start: string;
  customer: Customer;
}

export interface Confirmation {
  code: string;
  serviceId: string;
  date: string;
  start: string;
  customer: Customer;
}
