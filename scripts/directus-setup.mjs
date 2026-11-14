#!/usr/bin/env node
// Cria no Directus a estrutura da seção de Avisos do site da G2A:
//   - coleção "avisos" com título, resumo, categoria, capa, texto e anexos (imagens/PDF)
//   - gera o slug automaticamente a partir do título (Flow)
//   - usuário só-leitura com token para o servidor do site (o painel não fica público)
//   - papel "Equipe G2A" para quem publica (sem acesso de administrador)
//
// Uso (uma vez, depois do primeiro deploy):
//   DIRECTUS_URL=https://painel.g2asolucoescontabeis.com.br \
//   DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... npm run directus:setup
//
// Pode rodar de novo com segurança: o que já existe é mantido.

const URL_BASE = (process.env.DIRECTUS_URL ?? 'http://localhost:8055').replace(/\/$/, '');
const EMAIL = process.env.DIRECTUS_ADMIN_EMAIL;
const SENHA = process.env.DIRECTUS_ADMIN_PASSWORD;
if (!EMAIL || !SENHA) {
  console.error('Defina DIRECTUS_ADMIN_EMAIL e DIRECTUS_ADMIN_PASSWORD.');
  process.exit(1);
}

let token = '';
async function api(method, path, body) {
  const res = await fetch(URL_BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json.errors ?? json)}`);
  return json.data;
}
const passo = (m) => console.log('•', m);

token = (await api('POST', '/auth/login', { email: EMAIL, password: SENHA })).access_token;

const CATEGORIAS = ['Prazos', 'Fiscal', 'Trabalhista', 'Reforma Tributária', 'Comunicados'];
const existentes = new Set((await api('GET', '/collections?limit=-1')).map((c) => c.collection));

// ---------- Coleção avisos ----------
if (!existentes.has('avisos')) {
  await api('POST', '/collections', {
    collection: 'avisos',
    meta: {
      icon: 'campaign',
      note: 'Avisos publicados na página /avisos do site',
      display_template: '{{titulo}}',
      archive_field: 'status',
      archive_value: 'archived',
      unarchive_value: 'draft',
      sort_field: null,
      translations: [{ language: 'pt-BR', translation: 'Avisos', singular: 'Aviso', plural: 'Avisos' }],
    },
    schema: {},
    fields: [
      { field: 'id', type: 'uuid', meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] }, schema: { is_primary_key: true, length: 36, has_auto_increment: false } },
      {
        field: 'status',
        type: 'string',
        meta: {
          width: 'half',
          sort: 1,
          interface: 'select-dropdown',
          display: 'labels',
          options: {
            choices: [
              { text: 'Publicado', value: 'published', color: '#0caad1' },
              { text: 'Rascunho', value: 'draft', color: '#a2b5cd' },
              { text: 'Arquivado', value: 'archived', color: '#5a6178' },
            ],
          },
          display_options: {
            showAsDot: true,
            choices: [
              { text: 'Publicado', value: 'published', color: '#0caad1', foreground: '#fff', background: '#0caad1' },
              { text: 'Rascunho', value: 'draft', color: '#a2b5cd', foreground: '#1b2763', background: '#a2b5cd' },
              { text: 'Arquivado', value: 'archived', color: '#5a6178', foreground: '#fff', background: '#5a6178' },
            ],
          },
          note: 'Só avisos "Publicado" aparecem no site',
          translations: [{ language: 'pt-BR', translation: 'Situação' }],
        },
        schema: { default_value: 'draft', is_nullable: false },
      },
      {
        field: 'publicado_em',
        type: 'timestamp',
        meta: { width: 'half', sort: 2, interface: 'datetime', display: 'datetime', note: 'Data mostrada no site; os mais recentes aparecem primeiro', translations: [{ language: 'pt-BR', translation: 'Data de publicação' }] },
        schema: { default_value: 'CURRENT_TIMESTAMP', is_nullable: false },
      },
      {
        field: 'titulo',
        type: 'string',
        meta: { required: true, sort: 3, interface: 'input', options: { placeholder: 'Ex.: Prazo do IRPF 2027' }, translations: [{ language: 'pt-BR', translation: 'Título' }] },
        schema: { is_nullable: false },
      },
      {
        field: 'slug',
        type: 'string',
        meta: { sort: 4, interface: 'input', options: { slug: true, trim: true }, note: 'Endereço do aviso no site. Deixe em branco para gerar a partir do título.', translations: [{ language: 'pt-BR', translation: 'Endereço (slug)' }] },
        schema: { is_unique: true },
      },
      {
        field: 'categoria',
        type: 'string',
        meta: { width: 'half', sort: 5, interface: 'select-dropdown', display: 'labels', options: { choices: CATEGORIAS.map((c) => ({ text: c, value: c })) }, translations: [{ language: 'pt-BR', translation: 'Categoria' }] },
        schema: {},
      },
      {
        field: 'capa',
        type: 'uuid',
        meta: { width: 'half', sort: 6, interface: 'file-image', display: 'image', special: ['file'], note: 'Opcional. Imagem de destaque (também usada ao compartilhar no WhatsApp).', translations: [{ language: 'pt-BR', translation: 'Imagem de capa' }] },
        schema: {},
      },
      {
        field: 'resumo',
        type: 'text',
        meta: { sort: 7, interface: 'input-multiline', options: { softLength: 220 }, note: 'Uma ou duas frases que aparecem na lista de avisos', translations: [{ language: 'pt-BR', translation: 'Resumo' }] },
        schema: {},
      },
      {
        field: 'conteudo',
        type: 'text',
        meta: {
          sort: 8,
          interface: 'input-rich-text-html',
          options: { toolbar: ['bold', 'italic', 'h2', 'h3', 'numlist', 'bullist', 'link', 'removeformat', 'blockquote'] },
          translations: [{ language: 'pt-BR', translation: 'Texto' }],
        },
        schema: {},
      },
      { field: 'user_created', type: 'uuid', meta: { special: ['user-created'], interface: 'select-dropdown-m2o', readonly: true, hidden: true, width: 'half' }, schema: {} },
      { field: 'date_updated', type: 'timestamp', meta: { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, width: 'half' }, schema: {} },
    ],
  });
  await api('POST', '/relations', { collection: 'avisos', field: 'capa', related_collection: 'directus_files', schema: { on_delete: 'SET NULL' } });
  await api('POST', '/relations', { collection: 'avisos', field: 'user_created', related_collection: 'directus_users', schema: {} });
  passo('coleção avisos criada');
} else passo('coleção avisos já existe');

// ---------- Anexos (M2M com arquivos) ----------
if (!existentes.has('avisos_anexos')) {
  await api('POST', '/collections', {
    collection: 'avisos_anexos',
    meta: { hidden: true, icon: 'import_export' },
    schema: {},
    fields: [
      { field: 'id', type: 'integer', meta: { hidden: true }, schema: { is_primary_key: true, has_auto_increment: true } },
      { field: 'avisos_id', type: 'uuid', meta: { hidden: true }, schema: {} },
      { field: 'directus_files_id', type: 'uuid', meta: { hidden: true }, schema: {} },
      { field: 'sort', type: 'integer', meta: { hidden: true }, schema: {} },
    ],
  });
  await api('POST', '/fields/avisos', {
    field: 'anexos',
    type: 'alias',
    meta: {
      sort: 9,
      interface: 'files',
      special: ['files'],
      options: { enableCreate: true, enableSelect: true },
      note: 'PDFs e imagens do aviso. Arraste os arquivos aqui.',
      translations: [{ language: 'pt-BR', translation: 'Anexos (PDF e imagens)' }],
    },
  });
  await api('POST', '/relations', {
    collection: 'avisos_anexos',
    field: 'directus_files_id',
    related_collection: 'directus_files',
    meta: { one_field: null, junction_field: 'avisos_id', one_deselect_action: 'nullify' },
    schema: { on_delete: 'SET NULL' },
  });
  await api('POST', '/relations', {
    collection: 'avisos_anexos',
    field: 'avisos_id',
    related_collection: 'avisos',
    meta: { one_field: 'anexos', junction_field: 'directus_files_id', sort_field: 'sort', one_deselect_action: 'delete' },
    schema: { on_delete: 'CASCADE' },
  });
  passo('anexos criados');
} else passo('anexos já existem');

// ---------- Flow: gera slug a partir do título ----------
const NOME_FLOW = 'Avisos: gerar endereço (slug)';
const flows = await api('GET', `/flows?filter[name][_eq]=${encodeURIComponent(NOME_FLOW)}`);
if (flows.length === 0) {
  const flow = await api('POST', '/flows', {
    name: NOME_FLOW,
    icon: 'link',
    status: 'active',
    trigger: 'event',
    accountability: 'all',
    options: { type: 'filter', scope: ['items.create', 'items.update'], collections: ['avisos'], return: '$last' },
  });
  const op = await api('POST', '/operations', {
    flow: flow.id,
    name: 'Gerar slug',
    key: 'gerar_slug',
    type: 'exec',
    position_x: 19,
    position_y: 1,
    options: {
      code: `module.exports = async function (data) {
  const p = { ...data.$trigger.payload };
  const criando = String(data.$trigger.event || '').includes('create');
  const limpa = (s) => String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  if (p.slug) p.slug = limpa(p.slug);
  else if (criando && p.titulo) p.slug = limpa(p.titulo) + '-' + Date.now().toString(36).slice(-4);
  return p;
};`,
    },
  });
  await api('PATCH', `/flows/${flow.id}`, { operation: op.id });
  passo('flow de slug criado');
} else passo('flow de slug já existe');

// ---------- Acesso do site (somente leitura, via token) ----------
// O painel não expõe nada ao público. O servidor do site lê com um token próprio
// e entrega aos visitantes apenas avisos publicados e os arquivos deles.
const policies = await api('GET', '/policies?limit=-1&fields=id,name');

// With `restrita`, the given fields/filter are enforced even on an existing permission,
// so re-running the script also tightens installs made by older versions of it.
async function garantirPermissao(policy, collection, action, restrita) {
  const atuais = await api('GET', `/permissions?filter[policy][_eq]=${policy}&filter[collection][_eq]=${collection}&filter[action][_eq]=${action}`);
  if (atuais.length) {
    if (restrita) await api('PATCH', `/permissions/${atuais[0].id}`, restrita);
    return;
  }
  await api('POST', '/permissions', { policy, collection, action, fields: ['*'], ...restrita });
}

// The site token can only read published notices and the fields the site renders.
// If it leaks, drafts and panel internals stay out of reach.
const PUBLICADO = { status: { _eq: 'published' } };
const LEITURA_SITE = {
  avisos: {
    fields: ['id', 'status', 'titulo', 'slug', 'resumo', 'categoria', 'conteudo', 'publicado_em', 'capa', 'anexos'],
    permissions: PUBLICADO,
  },
  avisos_anexos: {
    fields: ['id', 'avisos_id', 'directus_files_id', 'sort'],
    permissions: { avisos_id: PUBLICADO },
  },
  // TODO: Directus cannot filter files by reverse relation here; the site proxy
  // (/arquivos) is what guarantees only files of published notices are served.
  directus_files: {
    fields: ['id', 'title', 'type', 'filesize', 'filename_download', 'width', 'height'],
    permissions: {},
  },
};

async function garantirPapel(nome, politica, descricao) {
  let pol = policies.find((p) => p.name === nome);
  if (!pol) pol = await api('POST', '/policies', { name: nome, icon: politica.icon, description: descricao, app_access: politica.app, admin_access: false });
  let papel = (await api('GET', `/roles?filter[name][_eq]=${encodeURIComponent(nome)}`))[0];
  if (!papel) {
    papel = await api('POST', '/roles', { name: nome, icon: politica.icon, description: descricao });
    await api('POST', '/access', { role: papel.id, policy: pol.id });
  }
  return { politica: pol, papel };
}

const site = await garantirPapel('Site (somente leitura)', { icon: 'public', app: false }, 'Usado pelo servidor do site para ler os avisos');
for (const [c, regra] of Object.entries(LEITURA_SITE)) await garantirPermissao(site.politica.id, c, 'read', regra);
passo('leitura do site restrita a avisos publicados e campos usados');

const EMAIL_SITE = 'site@g2asolucoescontabeis.com.br';
let usuarioSite = (await api('GET', `/users?filter[email][_eq]=${encodeURIComponent(EMAIL_SITE)}`))[0];
let tokenSite = null;
if (!usuarioSite) {
  tokenSite = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
  usuarioSite = await api('POST', '/users', { email: EMAIL_SITE, first_name: 'Site', last_name: 'G2A', role: site.papel.id, token: tokenSite, status: 'active' });
}
passo('usuário de leitura do site pronto');

// ---------- Papel da equipe ----------
const equipe = await garantirPapel('Equipe G2A', { icon: 'badge', app: true }, 'Publica e edita avisos do site');
for (const action of ['create', 'read', 'update', 'delete']) {
  await garantirPermissao(equipe.politica.id, 'avisos', action);
  await garantirPermissao(equipe.politica.id, 'avisos_anexos', action);
}
for (const action of ['create', 'read', 'update']) await garantirPermissao(equipe.politica.id, 'directus_files', action);
await garantirPermissao(equipe.politica.id, 'directus_folders', 'read');
await garantirPermissao(equipe.politica.id, 'directus_users', 'read');
passo('papel "Equipe G2A" pronto: convide a equipe em Configurações > Usuários');

// ---------- Nome do projeto e idioma ----------
await api('PATCH', '/settings', {
  project_name: 'G2A | Avisos do site',
  project_color: '#1b2763',
  default_language: 'pt-BR',
  project_url: 'https://g2asolucoescontabeis.com.br/avisos',
});
passo('painel configurado em português');
if (tokenSite) {
  console.log('\nToken do site (guarde agora, ele não aparece de novo). Coloque em DIRECTUS_TOKEN no Dokploy:');
  console.log(tokenSite);
} else {
  console.log('\nO usuário do site já existia. Para gerar outro token, edite o usuário', EMAIL_SITE, 'no painel.');
}
console.log('\nPronto.');
