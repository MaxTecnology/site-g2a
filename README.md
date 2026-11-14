# Site da G2A Soluções Contábeis

Site institucional em **Astro + Tailwind v4**, com a seção **Avisos** alimentada pelo **Directus**, onde a equipe publica textos, imagens e PDFs para os clientes.

```
visitante ──> site (Astro, Node) ──token só-leitura──> Directus ──> Postgres
                    │                                      └──> Backblaze B2 (arquivos)
                    └── /arquivos/:id  (proxy: só entrega arquivos de avisos publicados)
equipe ──> painel.g2asolucoescontabeis.com.br (Directus)
```

O painel não expõe nada ao público. O site lê os avisos com um token só-leitura e entrega aos visitantes apenas os avisos com situação **Publicado** e os arquivos deles. Rascunhos e arquivos soltos devolvem 404.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `src/data/site.ts` | Contatos, serviços, números e cronograma da reforma. **Edite aqui.** |
| `src/pages/` | Páginas. Home, `/avisos` e `/arquivos` rodam sob demanda; o resto é pré-renderizado. |
| `src/lib/directus.ts` | Leitura dos avisos e verificação dos arquivos. |
| `scripts/directus-setup.mjs` | Cria no Directus a coleção de avisos, o flow de slug e os papéis. |
| `public/calculadora.html` + `public/assets/` | Simulador da reforma (build React já existente, sem alterações). |
| `legacy/` | Site antigo (template W3layouts), só para referência. Pode ser apagado. |

## Desenvolvimento

```bash
npm install
cp .env.example .env   # DIRECTUS_URL e DIRECTUS_TOKEN (opcional: sem eles a seção Avisos fica vazia)
npm run dev
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
6. **DNS**: o domínio hoje aponta para o GitHub Pages (arquivo `public/CNAME`). Troque os registros A/CNAME para o IP do VPS e desative o Pages no repositório.

## Como a equipe publica um aviso

1. Entrar em `painel.g2asolucoescontabeis.com.br` (o admin convida cada pessoa com o papel **Equipe G2A**).
2. **Avisos → +**. Preencher título, categoria, resumo e texto. Imagem de capa é opcional.
3. Arrastar PDFs e imagens em **Anexos**.
4. Mudar a situação para **Publicado** e salvar. O aviso aparece no site em até 1 minuto.

O endereço do aviso é gerado do título. Uploads aceitos: JPG, PNG, WebP e PDF, até 25 MB.

## Licença do Directus

O Directus usa a BSL 1.1: o uso é gratuito para organizações com faturamento anual abaixo de US$ 5 milhões. Na versão gratuita, regras de permissão por item são restritas, e por isso o acesso público passa pelo site.
