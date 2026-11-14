# Plano de implementação: endurecimento do site G2A

Origem: análise técnica de 14/11/2026. Débitos que ficaram abertos estão em [tech-debt.md](tech-debt.md).

## Fase 1: segurança

- [x] Sanitizar o HTML dos avisos antes do `set:html` (`src/lib/sanitize.ts`, allowlist com `sanitize-html`)
- [x] Restringir o token do site no Directus: só avisos `published` e só os campos usados (`scripts/directus-setup.mjs`, aplicado também em instalações existentes)
- [x] Rate limit por IP em todas as respostas (600/min geral, 180/min em `/arquivos`), configurável por env (`server.mjs`)
- [x] Headers de segurança em páginas estáticas e SSR: CSP, HSTS (só via https), X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP
- [x] Cache curto para arquivos de avisos (5 min no navegador e 60 s na checagem de "publicado"), para que um aviso despublicado saia do ar rápido
- [x] Respostas de erro (404/502/503) com `no-store`, sem cache de indisponibilidade
- [x] Login do painel com `AUTH_LOGIN_ATTEMPTS=10`

## Fase 2: infra

- [x] `HEALTHCHECK` no Dockerfile e endpoint `/healthz`
- [x] Healthchecks de `site` e `directus` no compose, com `depends_on` condicionado a `service_healthy`
- [x] Directus fixado em `12.6.1`
- [x] Serviço `db-backup`: `pg_dump` diário com retenção de 14 dias
- [x] Variáveis novas documentadas em `.env.example.compose`
- [x] Encerramento gracioso no SIGTERM

## Fase 3: qualidade

- [x] SheetJS atualizado de 0.18.5 para 0.20.3 (CVE-2023-30533 e CVE-2024-22363)
- [x] Regras do Controle de jornada extraídas para `src/lib/jornada.ts`
- [x] Bugs corrigidos na extração: `8:75` era aceito como 9h15; "Dias trabalhados" negativo gerava horas negativas; a célula continuava vermelha depois de corrigida
- [x] Testes (Vitest, `npm test`): jornada, sanitização, IP do cliente, rate limit, headers

## Fase 3b: correções da revisão de código

- [x] Importação da jornada rejeita, com aviso, células de dia ilegíveis ou acima de 24h e jornada semanal acima de 168h, em vez de tratar como folga
- [x] Rate limit agrupa IPv6 por /64 (endereço rotativo não burla mais o limite)
- [x] Memória do limiter limitada com eviction O(1) e varredura no máximo uma vez por janela (sem fail-open)
- [x] Path normalizado antes do roteamento do limiter (`/%61rquivos` e `//arquivos` contam como `/arquivos`); encoding inválido devolve 400
- [x] `RATE_LIMIT_*=0` e `RATE_LIMIT_WINDOW_MS<1000` caem no padrão (antes, `0` bloqueava o site inteiro)
- [x] Backup só apaga dumps antigos depois de um dump bem-sucedido; em falha, tenta de novo em 5 min
- [x] `site` depende de `directus` com `service_started`: o site sobe mesmo com o CMS fora do ar

## Fase 3c: calculadora substituída

- [x] Calculadora removida por completo (`calculadora.html`, bundle React, `G2A3.png`, links no rodapé e na página da reforma)
- [x] `/calculadora.html` redireciona (308) para `/reforma-tributaria`, preservando links antigos e indexação
- [x] Novo diagnóstico de prontidão em `/reforma-tributaria#diagnostico`: 8 perguntas, nível de preparo, pendências em ordem de prioridade e envio opcional do resultado pelo WhatsApp. Sem dados pessoais e sem serviços externos
- [x] CSP sem nenhuma origem de terceiros para scripts, estilos, fontes, conexões e formulários

## Fase 3d: identidade visual

- [x] Home: hero com a "linha da G2A" (o traço do logo passando pelos marcos da reforma até hoje, terminando na seta do G)
- [x] Home: seção "Ferramentas gratuitas" (diagnóstico da reforma e controle de jornada) no lugar de números provisórios
- [x] Números "00" escondidos em produção (home e Sobre) até serem preenchidos em `src/data/site.ts`
- [x] Cabeçalho das páginas internas com a seta do G como marca discreta (só desktop, sem sobrepor conteúdo)
- [x] Sobre pronta para foto do escritório: basta preencher `site.fotoEscritorio`
- [x] Links de serviço com a seta do logo; token `--color-navy-linha` para a linha apagada

## Fase 4: SEO e limpeza

- [x] `/sitemap-avisos.xml` dinâmico com a home, `/avisos` e os avisos publicados, referenciado no `sitemap-index.xml`
- [x] Removido `legacy/` (recuperável pelo commit `903d7fa`)
- [x] README atualizado (estrutura, testes, backups, re-execução do setup)

## Pendências que dependem do cliente ou do dono do projeto

- [ ] **Revogar as chaves da AbstractAPI** e fechar o Google Forms de leads da antiga calculadora (ver tech-debt, item 1)
- [ ] Validar com o escritório o texto das 8 perguntas do diagnóstico (`src/lib/prontidao.ts`)
- [ ] Preencher os números reais, o horário e o CRC em `src/data/site.ts`
- [ ] Depois do deploy, rodar de novo `npm run directus:setup` para aplicar as permissões restritas

## Validação após o deploy

```bash
curl -sI https://g2asolucoescontabeis.com.br/ | grep -iE 'content-security|strict-transport|x-frame'
curl -s https://g2asolucoescontabeis.com.br/healthz              # ok
curl -s https://g2asolucoescontabeis.com.br/sitemap-avisos.xml   # lista home, /avisos e avisos
docker compose logs db-backup | tail                              # "backup ok: ..."
```

**Arquivos com o token real:** depois de rodar o `directus:setup`, abrir um aviso com imagem e PDF e conferir se a imagem redimensionada (`?w=900`) e o download do PDF funcionam. Se derem 403/404, o `/assets` do Directus precisa de mais campos de `directus_files` do que os 7 liberados em `LEITURA_SITE`; adicione os campos pedidos e rode o setup de novo.

Teste manual: abrir `/reforma-tributaria#diagnostico` (responder tudo, refazer, botão do WhatsApp), `/controle-de-jornada` (importar planilha, editar célula, exportar) e `/contato` (mapa), com o console do navegador aberto, procurando erros de CSP.
