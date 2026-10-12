/* Small stroke icons drawn inline so the board has no icon dependency. */
const base = { viewBox: "0 0 16 16", "aria-hidden": true, focusable: false } as const;

export const ChevronLeft = () => (
  <svg {...base} className="icon"><path d="M10 3 5 8l5 5" /></svg>
);
export const ChevronRight = () => (
  <svg {...base} className="icon"><path d="m6 3 5 5-5 5" /></svg>
);
export const Plus = () => (
  <svg {...base} className="icon"><path d="M8 3v10M3 8h10" /></svg>
);
export const CalendarIcon = () => (
  <svg {...base} className="icon"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>
);
export const Close = () => (
  <svg {...base} className="icon"><path d="m4 4 8 8M12 4l-8 8" /></svg>
);
export const Search = () => (
  <svg {...base} className="icon"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" /></svg>
);
