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
  escalaSemAcordo,
  exigeAcordo,
  resumoSemana,
  MODELOS_SEMANA,
  limiteDiarioSemAcordo,
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
    ['8:00:00', 480],
    ['44:00', 2640],
    ['44:00:00', 2640],
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
    expect(parseH('8:00:75')).toBeNaN();
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

  it('adds a weekday instead of suggesting days above the 10h cap', () => {
    // 44h over 4 days: 42h / 4 would be 10h30 per day
    const prop = sugerirEscala(semana(11, 11, 11, 11, 0, 0, 0), 42);
    expect(soma(prop)).toBe(h(42));
    expect(Math.max(...prop)).toBeLessThanOrEqual(600);
    expect(prop[4]).toBeGreaterThan(0); // Friday added
    expect(prop.slice(5)).toEqual([0, 0]);
  });

  it('adds only as many days as needed to respect the 10h cap', () => {
    // 40h in 2 days of 20h -> 4 days of 10h (the closest change to the current week)
    const prop = sugerirEscala(semana(20, 20, 0, 0, 0, 0, 0), 40);
    expect(prop).toEqual(semana(10, 10, 10, 10, 0, 0, 0));
  });

  it('flags a schedule with a day above 10h as needing adjustment', () => {
    const atual = semana(20, 20, 0, 0, 0, 0, 0);
    expect(analisar({ atual, prop: sugerirEscala(atual, 40) }, { etapa: 40, limdia: 480 }).precisa).toBe(true);
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

  it('reports an unreadable weekly total as invalid, not as missing', () => {
    expect(linhaParaColaborador({ Nome: 'Y', 'Jornada semanal': '8:75' }, 0)).toEqual({ invalido: 'Y' });
    expect(linhaParaColaborador({ Nome: 'Y', 'Jornada semanal': '' }, 0)).toEqual({ semHoras: 'Y' });
  });

  it('rejects a weekly total larger than a week', () => {
    expect(linhaParaColaborador({ Nome: 'Y', 'Jornada semanal': '200' }, 0)).toEqual({ invalido: 'Y' });
  });

  it('reads a weekly total typed as an Excel duration (raw:false text)', () => {
    const r = linhaParaColaborador({ Nome: 'Z', 'Jornada semanal': '44:00', 'Dias trabalhados': '6' }, 0);
    expect(r && 'colaborador' in r && r.colaborador.atual).toEqual(semana(8, 8, 8, 8, 8, 4, 0));
  });

  it('does not take unrelated columns as worked days or registration number', () => {
    const r = linhaParaColaborador({ Nome: 'Z', Idade: '34', 'Jornada semanal': '44', 'Dias de folga': '1' }, 0);
    expect(r && 'colaborador' in r && r.colaborador.mat).toBe('L2');
    // "Dias de folga" ignored: 44h -> default 6 days
    expect(r && 'colaborador' in r && r.colaborador.atual).toEqual(semana(8, 8, 8, 8, 8, 4, 0));
  });

  it('rejects a weekly total that would put more than 24h in a day', () => {
    expect(linhaParaColaborador({ Nome: 'Z', 'Jornada semanal': '44', 'Dias trabalhados': '1' }, 0)).toEqual({ invalido: 'Z' });
  });
});

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;');
    expect(esc(null)).toBe('');
  });
});

describe('escalaSemAcordo', () => {
  it('44h in 6 days under the 42h rule becomes 5 x 8h, with no day above 8h', () => {
    const r = escalaSemAcordo(semana(8, 8, 8, 8, 8, 4, 0), 42, 480);
    expect(r).toEqual(semana(8, 8, 8, 8, 8, 0, 0));
    expect(exigeAcordo(r, 480)).toBe(false);
  });

  it('keeps the suggestion when it already fits the daily limit', () => {
    const atual = semana(8, 8, 8, 8, 8, 0, 0);
    expect(escalaSemAcordo(atual, 42, 480)).toEqual(sugerirEscala(atual, 42));
  });

  it('respects a different daily limit', () => {
    const r = escalaSemAcordo(semana(9, 9, 9, 9, 8, 0, 0), 42, 528);
    expect(Math.max(...r)).toBeLessThanOrEqual(528);
    expect(r.slice(5)).toEqual([0, 0]);
  });

  it('returns an empty week unchanged', () => {
    expect(escalaSemAcordo([0, 0, 0, 0, 0, 0, 0], 42, 480)).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe('exigeAcordo', () => {
  it('is true only between the daily limit and the 10h cap', () => {
    expect(exigeAcordo(semana(8.4, 8, 0, 0, 0, 0, 0), 480)).toBe(true);
    expect(exigeAcordo(semana(8, 8, 0, 0, 0, 0, 0), 480)).toBe(false);
    expect(exigeAcordo(semana(11, 0, 0, 0, 0, 0, 0), 480)).toBe(false); // above 10h is an error, not an agreement
  });
});

describe('resumoSemana and MODELOS_SEMANA', () => {
  it('describes a week in plain words', () => {
    expect(resumoSemana(semana(8, 8, 8, 8, 8, 4, 0))).toBe('44h em 6 dias');
    expect(resumoSemana(semana(6, 0, 0, 0, 0, 0, 0))).toBe('6h em 1 dia');
  });
  it('ready-made weeks add up to what their label says', () => {
    for (const m of MODELOS_SEMANA) {
      const horas = Number(m.rotulo.match(/\((\d+)h\)/)![1]);
      expect(soma(m.dias)).toBe(horas * 60);
    }
  });
});

describe('limiteDiarioSemAcordo (STF injunction, 42h transition)', () => {
  it('is 8h24 in the 42h stage and 8h otherwise', () => {
    expect(limiteDiarioSemAcordo(42)).toBe(504);
    expect(limiteDiarioSemAcordo(40)).toBe(480);
    expect(limiteDiarioSemAcordo(44)).toBe(480);
  });

  it('6x1 of 44h becomes 5 x 8h24 with no agreement and no warning in the 42h stage', () => {
    const atual = semana(8, 8, 8, 8, 8, 4, 0);
    const prop = sugerirEscala(atual, 42);
    expect(prop).toEqual([504, 504, 504, 504, 504, 0, 0]);
    expect(exigeAcordo(prop, limiteDiarioSemAcordo(42))).toBe(false);
    const a = analisar({ atual, prop }, { etapa: 42, limdia: limiteDiarioSemAcordo(42) });
    expect(a.alerts).toEqual([]);
    expect(escalaSemAcordo(atual, 42, limiteDiarioSemAcordo(42))).toEqual(prop);
  });

  it('a day above 8h24 in the 42h stage still needs an agreement', () => {
    const prop = semana(9, 9, 9, 9, 6, 0, 0); // 42h
    expect(exigeAcordo(prop, limiteDiarioSemAcordo(42))).toBe(true);
  });

  it('8h24 is not allowed without agreement in the 40h stage', () => {
    expect(exigeAcordo([504, 504, 480, 480, 432, 0, 0], limiteDiarioSemAcordo(40))).toBe(true);
  });
});
