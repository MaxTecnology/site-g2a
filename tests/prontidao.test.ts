import { describe, expect, it } from 'vitest';
import { avaliar, mensagemWhatsapp, PERGUNTAS, type Resposta } from '../src/lib/prontidao';

const todas = (r: Resposta) => Object.fromEntries(PERGUNTAS.map((p) => [p.id, r]));

describe('avaliar', () => {
  it('everything done -> 100% and "adiantada" with no pending items', () => {
    const r = avaliar(todas('sim'));
    expect(r).toMatchObject({ pontuacao: 100, nivel: 'adiantada', completo: true, respondidas: 8 });
    expect(r.pendencias).toEqual([]);
  });

  it('nothing done -> 0% and "atencao" listing every question', () => {
    const r = avaliar(todas('nao'));
    expect(r.pontuacao).toBe(0);
    expect(r.nivel).toBe('atencao');
    expect(r.pendencias).toHaveLength(PERGUNTAS.length);
  });

  it('"não sei" counts as pending, never as done', () => {
    const r = avaliar(todas('naosei'));
    expect(r.pontuacao).toBe(0);
    expect(r.pendencias.every((p) => p.resposta === 'naosei')).toBe(true);
  });

  it('weights the score by importance', () => {
    // only the two weight-3 items (6 of 15)
    expect(avaliar({ erp: 'sim', cadastro: 'sim' }).pontuacao).toBe(40);
    // only the three weight-1 items (3 of 15)
    expect(avaliar({ beneficios: 'sim', contratos: 'sim', equipe: 'sim' }).pontuacao).toBe(20);
  });

  it('an outdated NF-e system caps the level even with a high score', () => {
    const r = avaliar({ ...todas('sim'), erp: 'nao' });
    expect(r.pontuacao).toBe(80);
    expect(r.nivel).toBe('andamento');
    expect(avaliar({ ...todas('sim'), erp: 'naosei' }).nivel).toBe('andamento');
  });

  it('level thresholds: 75% and 40%', () => {
    // 12/15 = 80% with erp done -> adiantada
    expect(avaliar({ ...todas('sim'), reducoes: 'nao', beneficios: 'nao' }).nivel).toBe('adiantada');
    // 9/15 = 60%
    expect(avaliar({ ...todas('sim'), reducoes: 'nao', preco: 'nao', fornecedores: 'nao' }).nivel).toBe('andamento');
    // 5/15 = 33%
    expect(avaliar({ erp: 'sim', preco: 'sim', ...{ cadastro: 'nao' } }).nivel).toBe('atencao');
  });

  it('orders pending items by weight, "não" before "não sei" on ties', () => {
    const r = avaliar({ equipe: 'nao', cadastro: 'naosei', erp: 'nao', preco: 'naosei', reducoes: 'nao' });
    expect(r.pendencias.map((p) => p.id)).toEqual(['erp', 'cadastro', 'reducoes', 'preco', 'equipe']);
  });

  it('ignores unknown ids and invalid answers, and tracks completion', () => {
    const r = avaliar({ erp: 'sim', foo: 'sim', cadastro: 'talvez' as Resposta });
    expect(r.respondidas).toBe(1);
    expect(r.completo).toBe(false);
    expect(avaliar({}).respondidas).toBe(0);
  });
});

describe('mensagemWhatsapp', () => {
  it('summarizes the level, score and pending topics', () => {
    const msg = mensagemWhatsapp(avaliar({ ...todas('sim'), cadastro: 'nao', contratos: 'naosei' }));
    expect(msg).toContain('Resultado: No caminho, com pontos em aberto (73% pronta).');
    expect(msg).toContain('- Cadastro\n- Contratos (não sei)');
  });

  it('omits the pending list when everything is done', () => {
    expect(mensagemWhatsapp(avaliar(todas('sim')))).not.toContain('Pontos em aberto');
  });
});
