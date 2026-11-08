const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }

export const IcoHoy = (p) => <svg {...base} {...p}><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /></svg>
export const IcoAlumnos = (p) => <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2" /></svg>
export const IcoAjustes = (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
export const IcoAtras = (p) => <svg {...base} {...p} strokeWidth={2.2}><path d="M15 6l-6 6 6 6" /></svg>
export const IcoAdelante = (p) => <svg {...base} {...p} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></svg>
export const IcoCheck = (p) => <svg {...base} {...p} strokeWidth={2.4}><path d="M5 12l5 5 9-10" /></svg>
export const IcoMas = (p) => <svg {...base} {...p} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
export const IcoCerrar = (p) => <svg {...base} {...p} strokeWidth={2.2}><path d="M6 6l12 12M18 6L6 18" /></svg>
