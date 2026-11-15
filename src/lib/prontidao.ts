// "Is your company ready for the Tax Reform?" self-assessment.
// Runs entirely in the browser: no personal data is collected or sent anywhere.
// The visitor may choose to send the result to the office over WhatsApp.

export type Resposta = 'sim' | 'nao' | 'naosei';

export type Pergunta = {
  id: string;
  tema: string;
  pergunta: string;
  /** What to do when the answer is "não" or "não sei". */
  acao: string;
  /** Relative importance; system/NF-e items weigh more because they block invoicing. */
  peso: number;
};

export const PERGUNTAS: readonly Pergunta[] = [
  {
    id: 'erp',
    tema: 'Nota fiscal',
    pergunta: 'O seu ERP ou emissor já gera a NF-e com os campos de IBS, CBS e Imposto Seletivo?',
    acao: 'Atualizar o ERP ou emissor com os novos campos da NF-e, que já são exigidos desde 2026.',
    peso: 3,
  },
  {
    id: 'cadastro',
    tema: 'Cadastro',
    pergunta: 'A classificação dos seus produtos (NCM) e serviços (NBS) foi revisada?',
    acao: 'Revisar NCM e NBS. A classificação define a alíquota, as reduções e os créditos.',
    peso: 3,
  },
  {
    id: 'reducoes',
    tema: 'Alíquotas',
    pergunta: 'Você sabe quais itens que vende têm alíquota reduzida, zerada ou regime específico?',
    acao: 'Mapear os itens com alíquota reduzida, zerada ou em regime específico.',
    peso: 2,
  },
  {
    id: 'preco',
    tema: 'Preço e margem',
    pergunta: 'Já simulou o efeito da CBS e do IBS no preço de venda e na margem?',
    acao: 'Simular o impacto no preço e na margem antes da CBS plena, em 2027.',
    peso: 2,
  },
  {
    id: 'fornecedores',
    tema: 'Créditos',
    pergunta: 'Sabe quanto de crédito os seus principais fornecedores vão gerar?',
    acao: 'Avaliar os fornecedores: o regime de cada um muda o crédito que a sua empresa aproveita.',
    peso: 2,
  },
  {
    id: 'beneficios',
    tema: 'Benefícios fiscais',
    pergunta: 'Os benefícios de ICMS que a empresa usa estão mapeados, com o efeito da redução até 2032?',
    acao: 'Mapear os benefícios de ICMS e o efeito da redução gradual no caixa até 2032.',
    peso: 1,
  },
  {
    id: 'contratos',
    tema: 'Contratos',
    pergunta: 'Os contratos de longo prazo preveem o reequilíbrio por mudança de tributo?',
    acao: 'Revisar os contratos longos e prever o reequilíbrio pela mudança dos tributos.',
    peso: 1,
  },
  {
    id: 'equipe',
    tema: 'Equipe',
    pergunta: 'As equipes fiscal e de faturamento estão preparadas para operar os dois sistemas na transição?',
    acao: 'Treinar as equipes fiscal e de faturamento para a convivência dos dois sistemas.',
    peso: 1,
  },
];

export type Nivel = 'adiantada' | 'andamento' | 'atencao';

export const NIVEIS: Record<Nivel, { titulo: string; texto: string }> = {
  adiantada: {
    titulo: 'Bem encaminhada',
    texto: 'A base está feita. Agora é acompanhar a regulamentação e revisar os pontos abaixo.',
  },
  andamento: {
    titulo: 'No caminho, com pontos em aberto',
    texto: 'Parte da adaptação está feita, mas os itens abaixo podem gerar erro na nota ou perda de crédito.',
  },
  atencao: {
    titulo: 'Precisa de atenção agora',
    texto: 'A transição já começou e a empresa ainda tem as principais etapas pela frente. Vale começar pelo sistema e pelo cadastro.',
  },
};

export type Resultado = {
  respondidas: number;
  completo: boolean;
  /** 0..100, weighted by `peso`; only "sim" scores. */
  pontuacao: number;
  nivel: Nivel;
  /** Pending actions, heaviest first, "não" before "não sei" on ties. */
  pendencias: (Pergunta & { resposta: Exclude<Resposta, 'sim'> })[];
};

const PESO_TOTAL = PERGUNTAS.reduce((s, p) => s + p.peso, 0);

export function avaliar(respostas: Partial<Record<string, Resposta>>): Resultado {
  let pontos = 0;
  let respondidas = 0;
  const pendencias: Resultado['pendencias'] = [];

  for (const p of PERGUNTAS) {
    const r = respostas[p.id];
    if (r !== 'sim' && r !== 'nao' && r !== 'naosei') continue;
    respondidas++;
    if (r === 'sim') pontos += p.peso;
    else pendencias.push({ ...p, resposta: r });
  }

  pendencias.sort((a, b) => b.peso - a.peso || (a.resposta === 'nao' ? -1 : 0) - (b.resposta === 'nao' ? -1 : 0));

  const pontuacao = Math.round((pontos / PESO_TOTAL) * 100);
  // An outdated NF-e system blocks invoicing, so it caps the level regardless of the score.
  const bloqueio = respostas.erp === 'nao' || respostas.erp === 'naosei';
  const nivel: Nivel = pontuacao >= 75 && !bloqueio ? 'adiantada' : pontuacao >= 40 ? 'andamento' : 'atencao';

  return { respondidas, completo: respondidas === PERGUNTAS.length, pontuacao, nivel, pendencias };
}

/** WhatsApp message with the result, so the conversation starts from the diagnosis. */
export function mensagemWhatsapp(r: Resultado): string {
  const linhas = [
    'Olá! Fiz o diagnóstico da Reforma Tributária no site da G2A.',
    `Resultado: ${NIVEIS[r.nivel].titulo} (${r.pontuacao}% pronta).`,
  ];
  if (r.pendencias.length) {
    linhas.push('', 'Pontos em aberto:');
    for (const p of r.pendencias) linhas.push(`- ${p.tema}${p.resposta === 'naosei' ? ' (não sei)' : ''}`);
  }
  linhas.push('', 'Gostaria de conversar sobre o caso da minha empresa.');
  return linhas.join('\n');
}
