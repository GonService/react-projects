const base = { viewBox: "0 0 16 16", "aria-hidden": true, focusable: false, className: "icon" } as const;
export const Up = () => <svg {...base}><path d="m4 10 4-4 4 4" /></svg>;
export const Down = () => <svg {...base}><path d="m4 6 4 4 4-4" /></svg>;
export const Trash = () => <svg {...base}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" /></svg>;
export const Plus = () => <svg {...base}><path d="M8 3v10M3 8h10" /></svg>;
export const Printer = () => <svg {...base}><path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2" /><path d="M4.5 9.5h7v4h-7z" /></svg>;
export const Download = () => <svg {...base}><path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" /></svg>;
export const Upload = () => <svg {...base}><path d="M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10" /></svg>;
export const Save = () => <svg {...base}><path d="M3 2.5h8l2 2v9H3z" /><path d="M5.5 2.5v3h4v-3M5 13.5v-4h6v4" /></svg>;
