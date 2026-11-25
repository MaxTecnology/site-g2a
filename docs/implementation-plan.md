# Plano de implementação: endurecimento do site G2A

Origem: análise técnica de 14/11/2026. Débitos que ficaram abertos estão em [tech-debt.md](tech-debt.md).

## Fase 1: segurança

- [x] Sanitizar o HTML dos avisos antes do `set:html` (`src/lib/sanitize.ts`, allowlist com `sanitize-html`)
- [x] ~~Restringir o token do site no Directus~~: não é possível na licença Community (ver tech-debt, item 6); o site garante o filtro de publicados
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

## Fase 5: Controle de jornada simplificado

- [x] Cadastro de colaboradores direto na tela, com semanas prontas (planilha virou opção recolhida)
- [x] Um cartão por colaborador com o que muda em frase ("Hoje: 44h em 6 dias · Nova escala: 42h em 5 dias")
- [x] Acordo de compensação explicado como escolha, com "opção sem acordo" (até 8h/dia, semana menor)
- [x] Aba "Controle da semana" removida (registro de jornada é função do ponto eletrônico)
- [x] SheetJS (950 KB) carregado só ao importar/exportar planilha
- [x] Resumo para o WhatsApp sem nome de colaboradores
- [x] Layout de cartões no celular (antes, tabela de 13 colunas)
- [x] Etapa de 42h aceita 5 dias de até 8h24 sem acordo (liminar do STF de 12/11/2026); base legal reescrita citando a liminar

## Fase 6: Controle de jornada removido

- [x] Página, regras (`src/lib/jornada.ts`), testes e SheetJS removidos; o escritório usa um sistema próprio
- [x] `/controle-de-jornada` virou a página de apresentação do sistema próprio de jornada, com pedido de demonstração pelo WhatsApp (menu, rodapé e home mantidos)
- [ ] Confirmar com o escritório a lista do que o sistema faz (seção "O que o sistema acompanha")

## Fase 4: SEO e limpeza

- [x] `/sitemap-avisos.xml` dinâmico com a home, `/avisos` e os avisos publicados, referenciado no `sitemap-index.xml`
- [x] Removido `legacy/` (recuperável pelo commit `903d7fa`)
- [x] README atualizado (estrutura, testes, backups, re-execução do setup)

## Pendências que dependem do cliente ou do dono do projeto

- [ ] Validar com o escritório o texto das 8 perguntas do diagnóstico (`src/lib/prontidao.ts`)
- [ ] Preencher os números reais, o horário e o CRC em `src/data/site.ts`
- [ ] Depois do deploy, rodar `npm run directus:setup` e colocar o token em `DIRECTUS_TOKEN`

## Validação após o deploy

```bash
curl -sI https://g2asolucoescontabeis.com.br/ | grep -iE 'content-security|strict-transport|x-frame'
curl -s https://g2asolucoescontabeis.com.br/healthz              # ok
curl -s https://g2asolucoescontabeis.com.br/sitemap-avisos.xml   # lista home, /avisos e avisos
docker compose logs db-backup | tail                              # "backup ok: ..."
```

**Avisos com o token real:** depois de rodar o `directus:setup`, publicar um aviso com imagem e PDF e conferir que aparecem no site; um aviso em rascunho não pode aparecer nem ter seus arquivos acessíveis. (Fluxo validado contra Directus 12.6.1 local em 14/11/2026.)

Teste manual: abrir `/reforma-tributaria#diagnostico` (responder tudo, refazer, botão do WhatsApp), `/contato` (mapa), com o console do navegador aberto, procurando erros de CSP.
