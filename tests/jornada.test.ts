import { describe, expect, it } from 'vitest';
import {
  analisar,
  distribuirSemana,
  esc,
  fmt,
  folgasMinimas,
  horaValida,
  linhaParaColaborador,
  parseH,
  soma,
  sugerirEscala,
} from '../src/lib/jornada';

const h = (x: number) => Math.round(x * 60);
const semana = (...horas: number[]) => horas.map(h);

describe('parseH', () => {
  it.each([
    ['8', 480],
    ['8h', 480],
    ['8:30', 510],
    ['8h30', 510],
    ['8h30min', 510],
    ['8,5', 510],
    ['8.5', 510],
    [' 7 : 20 ', 440],
    ['folga', 0],
    ['FOLGA', 0],
    ['-', 0],
    ['', 0],
    ['0', 0],
  ])('"%s" -> %i min', (entrada, esperado) => {
    expect(parseH(entrada)).toBe(esperado);
  });

  it('reads Excel time fractions and numeric hours', () => {
    expect(parseH(1 / 3)).toBe(480);
    expect(parseH(8)).toBe(480);
    expect(parseH(7.33)).toBe(440);
  });

  it('treats null, negatives and non-finite numbers as zero', () => {
    expect(parseH(null)).toBe(0);
    expect(parseH(undefined)).toBe(0);
    expect(parseH(-3)).toBe(0);
    expect(parseH(Number.NaN)).toBe(0);
    expect(parseH(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('rejects minutes above 59 and garbage', () => {
    expect(parseH('8:75')).toBeNaN();
    expect(parseH('abc')).toBeNaN();
    expect(parseH('8h30x')).toBeNaN();
    expect(parseH('1234')).toBeNaN();
  });
});

describe('horaValida', () => {
  it('accepts 0..24h and rejects NaN or more than a day', () => {
    expect(horaValida(0)).toBe(true);
    expect(horaValida(1440)).toBe(true);
    expect(horaValida(1441)).toBe(false);
    expect(horaValida(Number.NaN)).toBe(false);
    expect(horaValida(-1)).toBe(false);
  });
});

describe('fmt', () => {
  it('formats hours and minutes', () => {
    expect(fmt(480)).toBe('8h');
    expect(fmt(510)).toBe('8h30');
    expect(fmt(65)).toBe('1h05');
    expect(fmt(480, 'in')).toBe('8:00');
    expect(fmt(445, 'in')).toBe('7:25');
  });
  it('handles negatives, rounding and empty values', () => {
    expect(fmt(-90)).toBe('−1h30');
    expect(fmt(59.6)).toBe('1h');
    expect(fmt(null)).toBe('');
    expect(fmt(Number.NaN)).toBe('');
  });
});

describe('folgasMinimas', () => {
  it('requires 2 days off up to 42h and 1 above', () => {
    expect(folgasMinimas(40)).toBe(2);
    expect(folgasMinimas(42)).toBe(2);
    expect(folgasMinimas(44)).toBe(1);
  });
});

describe('sugerirEscala', () => {
  it('keeps a compliant schedule untouched (and returns a copy)', () => {
    const atual = semana(8, 8, 8, 8, 8, 0, 0);
    const prop = sugerirEscala(atual, 42);
    expect(prop).toEqual(atual);
    expect(prop).not.toBe(atual);
  });

  it('44h over 6 days -> 42h over 5 days, dropping Saturday', () => {
    const prop = sugerirEscala(semana(8, 8, 8, 8, 8, 4, 0), 42);
    expect(soma(prop)).toBe(h(42));
    expect(prop[5]).toBe(0);
    expect(prop[6]).toBe(0);
    expect(prop.filter((v) => v > 0)).toHaveLength(5);
  });

  it('drops Sunday before Saturday', () => {
    const prop = sugerirEscala(semana(0, 8, 8, 8, 8, 8, 4), 42);
    expect(prop[6]).toBe(0);
    expect(prop[0]).toBe(0);
    expect(prop.filter((v) => v > 0)).toHaveLength(5);
  });

  it('drops both weekend days for a 7-day week under the 40h rule', () => {
    // Note: the "lightest weekday" fallback is unreachable (only 5 weekdays, maxDias >= 5).
    const prop = sugerirEscala(semana(8, 8, 2, 8, 8, 4, 4), 40);
    expect(prop[6]).toBe(0);
    expect(prop[5]).toBe(0);
    expect(prop.filter((v) => v > 0)).toHaveLength(5);
  });

  it('distributes the remainder minute by minute without losing time', () => {
    const prop = sugerirEscala([601, 601, 601, 601, 601, 0, 0], 42);
    expect(soma(prop)).toBe(h(42));
    expect(Math.max(...prop) - Math.min(...prop.filter((v) => v > 0))).toBeLessThanOrEqual(1);
  });

  it('only reduces days off when under the weekly limit but working too many days', () => {
    const atual = semana(6, 6, 6, 6, 6, 6, 0); // 36h but 6 days, 1 day off
    const prop = sugerirEscala(atual, 42);
    expect(soma(prop)).toBe(h(36));
    expect(prop.filter((v) => v > 0)).toHaveLength(5);
  });

  it('returns an empty week unchanged (nothing to reduce)', () => {
    expect(sugerirEscala([0, 0, 0, 0, 0, 0, 0], 42)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('analisar', () => {
  const cfg = { etapa: 42, limdia: 480 };

  it('flags an employee who needs adjusting and computes the reduction', () => {
    const atual = semana(8, 8, 8, 8, 8, 4, 0);
    const a = analisar({ atual, prop: sugerirEscala(atual, 42) }, cfg);
    expect(a.precisa).toBe(true);
    expect(a.reduzir).toBe(h(2));
    expect(a.meta).toBe(h(42));
    // 42h / 5 = 8h24 per day, above the 8h daily limit -> needs a compensation agreement
    expect(a.alerts).toContainEqual(['warn', '8h24/dia: exige acordo de compensação']);
  });

  it('reports critical alerts on a proposal above the rules', () => {
    const a = analisar({ atual: semana(8, 8, 8, 8, 8, 4, 0), prop: semana(11, 8, 8, 8, 8, 4, 0) }, cfg);
    const tipos = a.alerts.map(([k, t]) => `${k}:${t}`);
    expect(tipos).toContain('crit:Total acima de 42h');
    expect(tipos).toContain('crit:Menos de 2 folgas');
    expect(tipos).toContain('crit:Dia acima de 10h');
  });

  it('warns about hours missing from the target, ignoring a 5 minute tolerance', () => {
    const atual = semana(8, 8, 8, 8, 8, 0, 0);
    expect(analisar({ atual, prop: atual.map((v, i) => (i === 0 ? v - 5 : v)) }, cfg).alerts).toEqual([]);
    const a = analisar({ atual, prop: semana(8, 8, 8, 8, 6, 0, 0) }, cfg);
    expect(a.alerts).toContainEqual(['info', '2h abaixo da meta']);
  });

  it('accepts an already compliant employee', () => {
    const atual = semana(8, 8, 8, 8, 8, 0, 0);
    const a = analisar({ atual, prop: atual }, { etapa: 40, limdia: 480 });
    expect(a.precisa).toBe(false);
    expect(a.alerts).toEqual([]);
  });
});

describe('distribuirSemana', () => {
  it('maps 44h over 6 days to the classic 8h + Saturday 4h', () => {
    expect(distribuirSemana(h(44), 6)).toEqual(semana(8, 8, 8, 8, 8, 4, 0));
  });
  it('keeps the weekly total and puts the remainder on Monday', () => {
    const d = distribuirSemana(h(42), 5);
    expect(soma(d)).toBe(h(42));
    expect(d.slice(5)).toEqual([0, 0]);
  });
  it('clamps the number of days to 1..7', () => {
    expect(soma(distribuirSemana(h(40), 0))).toBe(h(40));
    expect(distribuirSemana(h(40), 0).filter((v) => v > 0)).toHaveLength(1);
    expect(distribuirSemana(h(40), 12).filter((v) => v > 0)).toHaveLength(7);
    expect(soma(distribuirSemana(h(40), -3))).toBe(h(40));
  });
});

describe('linhaParaColaborador', () => {
  it('reads one column per weekday, with accents and long names', () => {
    const r = linhaParaColaborador(
      { Matrícula: 77, Nome: ' Ana ', Função: 'Caixa', Departamento: 'Loja', 'Segunda-feira': '8:00', Terça: '8', Sábado: '4h', Domingo: '' },
      0,
    );
    expect(r).toEqual({
      colaborador: { id: '77', mat: '77', nome: 'Ana', cargo: 'Caixa', setor: 'Loja', atual: semana(8, 8, 0, 0, 0, 4, 0), prop: null },
    });
  });

  it('builds the week from the weekly total and worked days', () => {
    const r = linhaParaColaborador({ Nome: 'João', 'Jornada semanal': '44', 'Dias trabalhados': '6' }, 3);
    expect(r && 'colaborador' in r && r.colaborador.atual).toEqual(semana(8, 8, 8, 8, 8, 4, 0));
    expect(r && 'colaborador' in r && r.colaborador.mat).toBe('L5');
  });

  it('ignores invalid worked days and infers 5 or 6 days from the total', () => {
    const r = linhaParaColaborador({ Nome: 'X', 'Carga horária': '40', Dias: '-2' }, 0);
    expect(r && 'colaborador' in r && r.colaborador.atual.filter((v) => v > 0)).toHaveLength(5);
  });

  it('reports rows without hours and skips rows without a name', () => {
    expect(linhaParaColaborador({ Nome: 'Sem horas' }, 0)).toEqual({ semHoras: 'Sem horas' });
    expect(linhaParaColaborador({ Nome: '   ', Seg: '8' }, 0)).toBeNull();
    expect(linhaParaColaborador({ Cargo: 'x' }, 0)).toBeNull();
  });

  it('rejects rows with unreadable day cells instead of turning them into days off', () => {
    expect(linhaParaColaborador({ Nome: 'Y', Seg: 'abc', Ter: '8' }, 0)).toEqual({ invalido: 'Y' });
    expect(linhaParaColaborador({ Nome: 'Y', Seg: '8:75' }, 0)).toEqual({ invalido: 'Y' });
    // 480 typed as minutes in an hours column = 480h
    expect(linhaParaColaborador({ Nome: 'Y', Seg: 480 }, 0)).toEqual({ invalido: 'Y' });
  });

  it('treats empty day cells as days off', () => {
    const r = linhaParaColaborador({ Nome: 'Y', Seg: '', Ter: '8', Dom: 'folga' }, 0);
    expect(r && 'colaborador' in r && r.colaborador.atual).toEqual(semana(0, 8, 0, 0, 0, 0, 0));
  });

  it('rejects a weekly total larger than a week', () => {
    expect(linhaParaColaborador({ Nome: 'Y', 'Jornada semanal': '200' }, 0)).toEqual({ invalido: 'Y' });
  });
});

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
    expect(esc(null)).toBe('');
  });
});
