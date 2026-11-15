// Business rules of the "Controle de jornada" planner (reduction of the weekly working
// hours to 42h/40h with a minimum number of days off). Pure functions, all values in minutes.
// Used by src/pages/controle-de-jornada.astro and covered by tests/jornada.test.ts.

export const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
const SAB = 5;
const DOM = 6;

/** Hard daily cap (CLT art. 59: 8h + 2h overtime). */
export const MAX_DIA_MIN = 600;
const MIN_POR_DIA = 1440;

export type Escala = number[]; // 7 entries, minutes per weekday (Mon..Sun)

export type Colaborador = {
  id: string;
  mat: string;
  nome: string;
  cargo: string;
  setor: string;
  atual: Escala;
  prop: Escala | null;
};

export type Config = { etapa: number; limdia: number };

export type Alerta = ['crit' | 'warn' | 'info', string];

export type Analise = {
  atual: number;
  meta: number;
  tot: number;
  diasAt: number;
  diasNv: number;
  precisa: boolean;
  reduzir: number;
  alerts: Alerta[];
};

export const soma = (a: readonly (number | null | undefined)[]) => a.reduce<number>((x, y) => x + (y || 0), 0);
export const diasTrabalhados = (a: readonly number[]) => a.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
export const limiteSemanal = (etapa: number) => etapa * 60;
/**
 * Longest day allowed without a compensation agreement, in minutes.
 * 42h stage: STF injunction (ADIs 8.041/8.042, 12/11/2026) allows 5 days of up to 8h24 with no
 * overtime for the extra 24 min, when there is no collective agreement, until 15/12/2027.
 * Other stages: CLT art. 58, 8h.
 */
export const limiteDiarioSemAcordo = (etapa: number) => (etapa === 42 ? 504 : 480);
/** Up to 42h/week the rule requires 2 days off; above that, 1. */
export const folgasMinimas = (etapa: number) => (etapa <= 42 ? 2 : 1);

/** Formats minutes as "8h30" (or "8:30" for inputs). Negative values get a minus sign. */
export function fmt(min: number | null | undefined, opt?: 'in'): string {
  if (min == null || Number.isNaN(min)) return '';
  const neg = min < 0;
  const abs = Math.round(Math.abs(min));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const mm = String(m).padStart(2, '0');
  const s = opt === 'in' ? `${h}:${m ? mm : '00'}` : m ? `${h}h${mm}` : `${h}h`;
  return (neg ? '−' : '') + s;
}

/**
 * Parses a duration typed by the user or read from a spreadsheet into minutes.
 * Accepts "8", "8h", "8,5", "8.5", "8:30", "8:30:00", "44:00", "8h30", "8h30min", "folga", "-",
 * fractions of a day below 1 (0.3333 = 8h) and plain numbers (hours). Returns NaN when it cannot parse.
 * Spreadsheets must be read as formatted text (sheet_to_json raw:false): a raw Excel duration
 * of 44:00 is the number 1.8333 (days) and cannot be told apart from 1.83 hours.
 */
export function parseH(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return 0;
    return Math.round(v < 1 ? v * MIN_POR_DIA : v * 60);
  }
  const s = String(v).trim().toLowerCase().replace(/\s/g, '');
  if (!s || s === '-' || s === 'folga' || s === '0') return 0;
  let m = s.match(/^(\d{1,3})[:h](\d{1,2})?(?::(\d{1,2}))?(?:m|min)?$/);
  if (m) {
    const min = m[2] ? +m[2] : 0;
    if (min > 59 || (m[3] && +m[3] > 59)) return NaN;
    return +m[1] * 60 + min;
  }
  m = s.match(/^(\d{1,3})(?:[.,](\d+))?h?$/);
  if (m) return Math.round(parseFloat(`${m[1]}.${m[2] || '0'}`) * 60);
  return NaN;
}

/** Valid value for a single day cell: a parsed number between 0 and 24h. */
export const horaValida = (v: number) => !Number.isNaN(v) && v >= 0 && v <= MIN_POR_DIA;

/**
 * Suggests a new week for the employee: keeps the schedule when it already complies,
 * otherwise drops Sunday, then Saturday, then the lightest day until the minimum days off
 * are reached, and spreads the capped weekly total evenly over the remaining days.
 */
export function sugerirEscala(atual: Escala, etapa: number): Escala {
  const lim = limiteSemanal(etapa);
  const maxDias = 7 - folgasMinimas(etapa);
  const total = soma(atual);
  const conforme = total <= lim && diasTrabalhados(atual) <= maxDias && Math.max(...atual) <= MAX_DIA_MIN;
  if (conforme) return atual.slice();

  let dias = atual.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  if (!dias.length) dias = [0, 1, 2, 3, 4];
  while (dias.length > maxDias) {
    // Sunday and Saturday always cover this today (5 weekdays, maxDias >= 5); the
    // lightest-day fallback only matters if a rule ever allows fewer than 5 days.
    const tirar = dias.includes(DOM) ? DOM : dias.includes(SAB) ? SAB : dias.reduce((a, b) => (atual[b] < atual[a] ? b : a));
    dias = dias.filter((d) => d !== tirar);
  }
  const meta = Math.round(Math.min(total, lim));
  // Spread over more days (weekdays first) before letting a suggested day pass the 10h cap.
  for (const d of [0, 1, 2, 3, 4, SAB]) {
    if (meta / dias.length <= MAX_DIA_MIN || dias.length >= maxDias) break;
    if (!dias.includes(d)) dias = [...dias, d].sort((a, b) => a - b);
  }
  const base = Math.floor(meta / dias.length);
  const extra = meta - base * dias.length;
  const out = [0, 0, 0, 0, 0, 0, 0];
  dias.forEach((d, k) => {
    out[d] = base + (k < extra ? 1 : 0);
  });
  return out;
}

/**
 * Alternative that needs no compensation agreement: same working days as the suggestion, but no
 * day above `limdia` (CLT art. 58: 8h). The week may end up shorter than the legal limit, e.g.
 * 44h in 6 days under the 42h rule becomes 40h (5 x 8h) instead of 42h (5 x 8h24).
 */
export function escalaSemAcordo(atual: Escala, etapa: number, limdia: number): Escala {
  const base = sugerirEscala(atual, etapa);
  const dias = base.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
  if (!dias.length) return base;
  const meta = soma(base);
  const porDia = Math.floor(meta / dias.length);
  if (porDia + (meta % dias.length ? 1 : 0) <= limdia) return base;
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dias) out[d] = Math.min(limdia, porDia);
  return out;
}

/** True when some day of the proposal is above `limdia` but still within the 10h legal cap. */
export const exigeAcordo = (prop: Escala, limdia: number) => prop.some((v) => v > limdia && v <= MAX_DIA_MIN);

/** Ready-made weeks for the "add employee" form (minutes, Mon..Sun). */
export const MODELOS_SEMANA: readonly { rotulo: string; dias: Escala }[] = [
  { rotulo: 'Seg a sex 8h + sáb 4h (44h)', dias: [480, 480, 480, 480, 480, 240, 0] },
  { rotulo: 'Seg a sáb 7h20 (44h)', dias: [440, 440, 440, 440, 440, 440, 0] },
  { rotulo: 'Seg a sex 8h48 (44h)', dias: [528, 528, 528, 528, 528, 0, 0] },
  { rotulo: 'Seg a sex 8h (40h)', dias: [480, 480, 480, 480, 480, 0, 0] },
];

/** "44h em 6 dias" */
export function resumoSemana(e: Escala): string {
  const n = diasTrabalhados(e);
  return `${fmt(soma(e))} em ${n} ${n === 1 ? 'dia' : 'dias'}`;
}

/** Compares the current and the proposed schedule against the weekly rule. */
export function analisar(e: { atual: Escala; prop: Escala }, cfg: Config): Analise {
  const lim = limiteSemanal(cfg.etapa);
  const folgas = folgasMinimas(cfg.etapa);
  const atual = soma(e.atual);
  const meta = Math.min(atual, lim);
  const tot = soma(e.prop);
  const diasAt = diasTrabalhados(e.atual);
  const diasNv = diasTrabalhados(e.prop);
  const precisa = atual > lim || 7 - diasAt < folgas || Math.max(...e.atual) > MAX_DIA_MIN;

  const alerts: Alerta[] = [];
  if (tot > lim) alerts.push(['crit', `Total acima de ${cfg.etapa}h`]);
  if (7 - diasNv < folgas) alerts.push(['crit', `Menos de ${folgas} folgas`]);
  const maxDia = Math.max(...e.prop);
  if (maxDia > MAX_DIA_MIN) alerts.push(['crit', 'Dia acima de 10h']);
  else if (maxDia > cfg.limdia) alerts.push(['warn', `${fmt(maxDia)}/dia: exige acordo de compensação`]);
  if (tot < meta - 5) alerts.push(['info', `${fmt(meta - tot)} abaixo da meta`]);

  return { atual, meta, tot, diasAt, diasNv, precisa, reduzir: Math.max(0, atual - meta), alerts };
}

// ---------- spreadsheet import ----------

const norm = (s: unknown) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const CHAVES_DIA = [
  ['seg', 'segunda', 'segundafeira'],
  ['ter', 'terca', 'tercafeira'],
  ['qua', 'quarta', 'quartafeira'],
  ['qui', 'quinta', 'quintafeira'],
  ['sex', 'sexta', 'sextafeira'],
  ['sab', 'sabado'],
  ['dom', 'domingo'],
];

type Linha = Record<string, unknown>;

/** Column lookup by normalized header. Prefix matching ("nomecompleto") unless `exato`. */
function pegar(row: Linha, nomes: string[], exato = false) {
  for (const k of Object.keys(row)) {
    const n = norm(k);
    if (nomes.some((x) => n === x || (!exato && n.startsWith(x)))) return row[k];
  }
  return undefined;
}

// Exact names only: a prefix would match "Idade" as "id" or "Dias de folga" as "dias".
const COLUNAS_MATRICULA = ['matricula', 'mat', 'codigo', 'cod', 'id', 'registro', 'chapa'];
const COLUNAS_DIAS = ['diastrabalhados', 'diasporsemana', 'diasdetrabalho', 'diastrabalhadosnasemana', 'dias'];

const SEMANA_44H = 44 * 60;

/** Spreads a weekly total over N days (rounded to 5 min, remainder on Monday). */
export function distribuirSemana(semanal: number, dias: number): Escala {
  const n = Math.min(7, Math.max(1, Math.trunc(dias)));
  if (n === 6 && semanal === SEMANA_44H) return [480, 480, 480, 480, 480, 240, 0];
  const out = [0, 0, 0, 0, 0, 0, 0];
  const b = Math.round(semanal / n / 5) * 5;
  for (let d = 0; d < n; d++) out[d] = b;
  out[0] += semanal - b * n;
  return out;
}

export type ResultadoLinha = { colaborador: Colaborador } | { semHoras: string } | { invalido: string } | null;

/**
 * Converts one spreadsheet row into an employee. Accepts either one column per weekday
 * or a weekly total ("Jornada semanal") plus optional "Dias trabalhados".
 * `indice` is the 0-based data row, used to build an id when there is no registration number.
 * A day cell that cannot be read (or is above 24h) rejects the row instead of becoming a day off,
 * which would silently make the employee look compliant.
 */
export function linhaParaColaborador(row: Linha, indice: number): ResultadoLinha {
  const nomeBruto = pegar(row, ['nome', 'colaborador', 'funcionario', 'empregado']);
  const nome = String(nomeBruto ?? '').trim();
  if (!nome) return null;
  const mat = String(pegar(row, COLUNAS_MATRICULA, true) ?? '').trim() || `L${indice + 2}`;

  const porDia = CHAVES_DIA.map((chaves) => {
    const k = Object.keys(row).find((c) => chaves.includes(norm(c)));
    return k === undefined ? undefined : parseH(row[k]);
  });

  let atual: Escala;
  if (porDia.every((v) => v === undefined)) {
    const semanal = parseH(pegar(row, ['jornadasemanal', 'horassemanais', 'cargahoraria', 'jornada', 'cargasemanal']));
    if (Number.isNaN(semanal)) return { invalido: nome };
    if (!semanal) return { semHoras: nome };
    if (semanal > 7 * MIN_POR_DIA) return { invalido: nome };
    const diasInformados = parseInt(String(pegar(row, COLUNAS_DIAS, true) ?? ''), 10);
    const dias = diasInformados >= 1 && diasInformados <= 7 ? diasInformados : semanal >= SEMANA_44H ? 6 : 5;
    atual = distribuirSemana(semanal, dias);
    if (atual.some((v) => !horaValida(v))) return { invalido: nome };
  } else {
    if (porDia.some((v) => v !== undefined && !horaValida(v))) return { invalido: nome };
    atual = porDia.map((v) => v ?? 0);
  }

  return {
    colaborador: {
      id: mat,
      mat,
      nome,
      cargo: String(pegar(row, ['cargo', 'funcao']) ?? '').trim(),
      setor: String(pegar(row, ['setor', 'departamento', 'depto', 'area']) ?? '').trim(),
      atual,
      prop: null,
    },
  };
}

/** Escapes text for interpolation into HTML strings. */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
