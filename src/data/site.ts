// Dados institucionais da G2A. Edite aqui para atualizar o site inteiro.

export const site = {
  nome: 'G2A Soluções Contábeis',
  cnpj: '14.255.140/0001-15',
  email: 'contato@g2asolucoescontabeis.cnt.br',
  whatsapp: '558235222755',
  telefoneExibicao: '(82) 3522-2755',
  endereco: {
    rua: 'Av. Deputada Ceci Cunha, 1179',
    bairro: 'Novo Horizonte',
    cidade: 'Arapiraca',
    uf: 'AL',
  },
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('G2A Soluções Contábeis, Av. Deputada Ceci Cunha, 1179, Arapiraca - AL'),
  // TODO: preencher. Enquanto for null, o horário não aparece no site.
  horario: null as string | null, // ex.: 'Segunda a sexta, das 8h às 18h'
  // TODO: preencher com o registro do escritório no CRC-AL. null = não exibe.
  crc: null as string | null,
};

export const whatsappLink = (mensagem = 'Olá! Vim pelo site da G2A e gostaria de falar com um contador.') =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(mensagem)}`;

// TODO: substituir pelos números reais antes de publicar.
// Enquanto algum valor tiver "placeholder: true", ele aparece com contorno tracejado em dev.
export const numeros = [
  { valor: '00', rotulo: 'anos de escritório em Arapiraca', placeholder: true },
  { valor: '000', rotulo: 'empresas atendidas todo mês', placeholder: true },
  { valor: '00', rotulo: 'municípios com clientes no agreste e sertão', placeholder: true },
  { valor: '00', rotulo: 'profissionais na equipe', placeholder: true },
];

export type Servico = {
  slug: string;
  nome: string;
  resumo: string;
  paraQuem: string;
  inclui: string[];
  mensagemWhatsapp: string;
};

export const servicos: Servico[] = [
  {
    slug: 'contabilidade-e-fiscal',
    nome: 'Contabilidade e fiscal',
    resumo:
      'Escrituração, apuração de impostos e obrigações acessórias para empresas do Simples Nacional, Lucro Presumido e Lucro Real.',
    paraQuem: 'Comércio, indústria e prestadores de serviço que querem os impostos em dia e números confiáveis para decidir.',
    inclui: [
      'Escrituração contábil e balancetes mensais',
      'Apuração de Simples Nacional, PIS/Cofins, ICMS, ISS, IRPJ e CSLL',
      'SPED Fiscal, EFD-Contribuições, ECD, ECF e DCTFWeb',
      'Balanço patrimonial e DRE anuais',
      'Adequação das notas fiscais aos campos de IBS e CBS',
    ],
    mensagemWhatsapp: 'Olá! Quero saber mais sobre contabilidade e fiscal para minha empresa.',
  },
  {
    slug: 'departamento-pessoal',
    nome: 'Departamento pessoal',
    resumo: 'Folha de pagamento, eSocial e rotinas trabalhistas do dia a dia, da admissão à rescisão.',
    paraQuem: 'Empresas com funcionários que precisam de folha correta, no prazo, e sem passivo trabalhista.',
    inclui: [
      'Admissões, férias, 13º e rescisões',
      'Folha de pagamento e pró-labore',
      'eSocial, FGTS Digital e DCTFWeb',
      'Controle de jornada e acordos de compensação',
      'Orientação sobre convenções coletivas',
    ],
    mensagemWhatsapp: 'Olá! Quero saber mais sobre departamento pessoal e folha de pagamento.',
  },
  {
    slug: 'abertura-e-legalizacao',
    nome: 'Abertura e legalização',
    resumo: 'Abertura, alteração e baixa de empresas, com alvarás, inscrições e licenças em ordem.',
    paraQuem: 'Quem vai abrir a primeira empresa, sair do MEI, mudar de endereço, incluir sócio ou encerrar atividades.',
    inclui: [
      'Escolha de natureza jurídica, CNAE e regime tributário',
      'Registro na Junta Comercial, Receita Federal, Sefaz-AL e prefeitura',
      'Alvarás, licenças e Corpo de Bombeiros',
      'Alterações contratuais e transformação de MEI em ME',
      'Baixa de empresa com as pendências resolvidas',
    ],
    mensagemWhatsapp: 'Olá! Quero abrir ou regularizar minha empresa.',
  },
  {
    slug: 'consultoria-e-planejamento',
    nome: 'Consultoria e planejamento tributário',
    resumo:
      'Análise do regime tributário, simulações de carga e preparação da empresa para a Reforma Tributária.',
    paraQuem: 'Empresários que querem pagar só o imposto devido e se antecipar às mudanças de 2027 em diante.',
    inclui: [
      'Comparativo entre Simples, Presumido e Real',
      'Diagnóstico e plano de adequação à Reforma Tributária',
      'Revisão de cadastros, NCM e parametrização fiscal no ERP',
      'Recuperação de créditos tributários',
      'Declaração de Imposto de Renda de sócios e pessoas físicas',
    ],
    mensagemWhatsapp: 'Olá! Quero uma conversa sobre planejamento tributário e Reforma Tributária.',
  },
];

// Transição da Reforma Tributária (EC 132/2023, LC 214/2025).
export const reforma = [
  { ano: '2026', titulo: 'Ano de teste', texto: 'CBS de 0,9% e IBS de 0,1% destacados na nota, compensados com PIS/Cofins.' },
  { ano: '2027', titulo: 'CBS plena', texto: 'PIS e Cofins extintos, IPI zerado (exceto ZFM) e início do Imposto Seletivo.' },
  { ano: '2029–2032', titulo: 'Troca gradual', texto: 'ICMS e ISS caem para 90%, 80%, 70% e 60%; o IBS sobe na mesma medida.' },
  { ano: '2033', titulo: 'Novo sistema', texto: 'ICMS e ISS extintos. Ficam CBS, IBS e Imposto Seletivo.' },
];
