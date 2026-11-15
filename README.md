# Site da G2A Soluções Contábeis

Site institucional em **Astro + Tailwind v4**, com a seção **Avisos** alimentada pelo **Directus**, onde a equipe publica textos, imagens e PDFs para os clientes.

```
visitante ──> site (Astro, Node) ──token só-leitura──> Directus ──> Postgres
                    │                                      └──> Backblaze B2 (arquivos)
                    └── /arquivos/:id  (proxy: só entrega arquivos de avisos publicados)
equipe ──> painel.g2asolucoescontabeis.com.br (Directus)
```

O painel não expõe nada ao público. O site lê os avisos com um token só-leitura e entrega aos visitantes apenas os avisos com situação **Publicado** e os arquivos deles. Rascunhos e arquivos soltos devolvem 404.

O token do site também é restrito no Directus: só lê avisos publicados e os campos que o site usa. O HTML dos avisos é sanitizado antes de ir para a página (`src/lib/sanitize.ts`).

Em produção o site roda por `server.mjs`, que envolve o servidor do Astro e adiciona a todas as respostas os headers de segurança (CSP, HSTS, X-Frame-Options...), o rate limit por IP e o `/healthz`.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `src/data/site.ts` | Contatos, serviços, números e cronograma da reforma. **Edite aqui.** |
| `src/pages/` | Páginas. Home, `/avisos` e `/arquivos` rodam sob demanda; o resto é pré-renderizado. |
| `src/lib/directus.ts` | Leitura dos avisos e verificação dos arquivos. |
| `src/lib/sanitize.ts` | Sanitização do HTML dos avisos (contra XSS). |
| `src/lib/jornada.ts` | Regras do Controle de jornada (cálculos, sugestão de escala, importação). |
| `server.mjs` + `server/http.mjs` | Entrypoint de produção: headers de segurança, rate limit e `/healthz`. |
| `scripts/directus-setup.mjs` | Cria no Directus a coleção de avisos, o flow de slug, os papéis e as permissões. |
| `src/lib/prontidao.ts` + `src/components/DiagnosticoReforma.astro` | Diagnóstico de prontidão para a Reforma (página `/reforma-tributaria#diagnostico`). Roda só no navegador. |
| `tests/` | Testes (Vitest) das regras de jornada, do diagnóstico, da sanitização e do servidor. |
| `docs/` | Plano de implementação e débito técnico. |

## Desenvolvimento

```bash
npm install
cp .env.example .env   # DIRECTUS_URL e DIRECTUS_TOKEN (opcional: sem eles a seção Avisos fica vazia)
npm run dev
npm test               # testes
npm run build && npm start   # produção local, via server.mjs
```

Na home, os números com `placeholder: true` aparecem com contorno tracejado em dev.

## Deploy no Dokploy

1. **B2**: crie um bucket privado e uma Application Key restrita a ele.
2. **Dokploy**: novo serviço do tipo *Docker Compose* apontando para este repositório (`docker-compose.yml`).
3. **Environment**: preencha as variáveis de `.env.example.compose`. Deixe `DIRECTUS_TOKEN` vazio por enquanto.
4. **Domains**:
   - `site` porta `4321` → `g2asolucoescontabeis.com.br` (e `www`)
   - `directus` porta `8055` → `painel.g2asolucoescontabeis.com.br`
5. Faça o deploy e rode o setup do painel uma única vez (de qualquer máquina):
   ```bash
   DIRECTUS_URL=https://painel.g2asolucoescontabeis.com.br \
   DIRECTUS_ADMIN_EMAIL=... DIRECTUS_ADMIN_PASSWORD=... \
   npm run directus:setup
   ```
   O script imprime o **token do site**. Coloque em `DIRECTUS_TOKEN` e faça redeploy.
6. **Já rodou o setup antes desta versão?** Rode de novo: ele aplica as permissões restritas ao token do site sem mexer no resto.
7. **DNS**: o domínio hoje aponta para o GitHub Pages (arquivo `public/CNAME`). Troque os registros A/CNAME para o IP do VPS e desative o Pages no repositório.

## Como a equipe publica um aviso

1. Entrar em `painel.g2asolucoescontabeis.com.br` (o admin convida cada pessoa com o papel **Equipe G2A**).
2. **Avisos → +**. Preencher título, categoria, resumo e texto. Imagem de capa é opcional.
3. Arrastar PDFs e imagens em **Anexos**.
4. Mudar a situação para **Publicado** e salvar. O aviso aparece no site em até 1 minuto.

O endereço do aviso é gerado do título. Uploads aceitos: JPG, PNG, WebP e PDF, até 25 MB.

## Backups

O serviço `db-backup` faz um `pg_dump` diário do Postgres no volume `db_backups` e guarda 14 dias (`BACKUP_RETENTION_DAYS`). Para restaurar:

```bash
docker compose exec db-backup sh -c 'pg_restore --clean --if-exists -d directus /backups/<arquivo>.dump'
```

Os dumps ficam no próprio VPS. Copiar para fora está em `docs/tech-debt.md`.

## Licença do Directus

O Directus usa a BSL 1.1: o uso é gratuito para organizações com faturamento anual abaixo de US$ 5 milhões. O acesso público passa pelo site para que o painel fique fechado.
