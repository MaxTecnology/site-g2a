# Débito técnico

Prioridade: **P1** resolver já · **P2** próximo ciclo · **P3** quando houver oportunidade.

## 1. ~~Chaves da AbstractAPI~~ (não se aplica)

A calculadora removida foi copiada de outro site. As chaves da AbstractAPI e o Google Forms que recebia os leads eram do autor original, não da G2A: não há nada a revogar do nosso lado.

Registro para a equipe: enquanto a calculadora esteve no ar, nome, e-mail, telefone e empresa dos visitantes da G2A iam para o formulário desse terceiro, sem aviso (ponto de LGPD) e sem que a G2A recebesse os contatos. Em 14/11/2026 o domínio já apontava para o VPS, ou seja, a calculadora não estava mais sendo servida. Não reutilizar ferramentas de terceiros sem revisar para onde vão os dados.

## 2. ~~Calculadora sem código-fonte~~ (resolvido)

Removida e substituída pelo diagnóstico de prontidão (`src/lib/prontidao.ts`), que não coleta dados pessoais e não chama serviços externos.

## 3. [P2] CSP com `'unsafe-inline'` em scripts e estilos

Ainda necessário para os scripts e estilos que o Astro injeta inline, o `define:vars` do contato e o JSON-LD. Sem a calculadora, a CSP não tem mais origens externas além das imagens de avisos (`https:`) e do mapa do Google. Próximo passo: avaliar `security.csp` do Astro (hashes automáticos) para eliminar o `'unsafe-inline'` dos scripts.

## 4. [P2] Backups só no próprio VPS

O `db-backup` grava no volume `db_backups`, no mesmo disco do banco. Se o VPS for perdido, os backups vão junto.

- Enviar os dumps para um bucket B2 separado, com uma chave só de escrita (por exemplo, `rclone` no mesmo container ou o backup nativo do Dokploy).
- Testar um restore a cada trimestre.

## 5. [P3] Rate limit em memória, por instância

`server.mjs` limita por IP em memória (IPv6 agrupado por /64). Funciona com uma réplica.

O IP vem do `X-Forwarded-For` com `TRUSTED_PROXY_HOPS=1`. Isso só é seguro enquanto a porta 4321 não for publicada: hoje o compose usa `expose`, e o único acesso é via Traefik. Se algum dia publicar a porta, o cliente pode forjar o IP. Com mais de uma, migrar para o middleware `rateLimit` do Traefik ou para um store compartilhado (Redis).

O painel (`painel.*`) não tem rate limit por IP, só `AUTH_LOGIN_ATTEMPTS`. O `RATE_LIMITER_*` global do Directus não serve: todas as leituras do site chegam do mesmo IP interno. Se necessário, usar um middleware do Traefik só no domínio do painel.

## 6. [P3] Token do site sem restrição no Directus

Na licença Community do Directus 12, permissões com filtro de linha ou lista de campos são bloqueadas (`RESOURCE_RESTRICTED: custom_permission_rules_enabled`). O token do site lê todos os campos de `avisos`, `avisos_anexos` e `directus_files`, incluindo rascunhos.

Quem garante que só o publicado chega ao visitante é o site: toda consulta filtra `status = published` e o proxy `/arquivos` só entrega arquivos de avisos publicados (testado contra Directus 12.6.1 real). Se o token vazar, rascunhos ficam legíveis.

- Manter o token só no Dokploy; trocar se houver suspeita de vazamento (editar o usuário `site@...` no painel).
- Se o plano do Directus mudar, voltar a restringir a leitura a `status = published`.

## 7. [P3] Conteúdo provisório

`src/data/site.ts`: os `numeros` (`placeholder: true`), o `horario` e o `crc` ainda não têm os valores reais. Os números aparecem como "00" em produção.

## 8. ~~Base legal do Controle de jornada~~ (resolvido)

O planejador de jornada foi removido do site em 25/11/2026: o escritório passou a usar um sistema próprio. `/controle-de-jornada` agora apresenta esse sistema e pede o contato para uma demonstração. O código está no histórico (tag `v1-astro-directus`).

## 9. [P3] Identificadores e comentários em português

O padrão do time é código, variáveis, funções e comentários inline em inglês. O projeto nasceu em português (`listarAvisos`, `servicos`, `site.endereco`, componentes `Cabecalho`, `ListaAvisos`...), e o código novo seguiu o padrão existente para não misturar os dois idiomas.

- Fazer a troca num PR próprio e mecânico (renomear símbolos, arquivos de componentes e comentários), sem mudança de comportamento, com os testes como rede de segurança.
- Textos exibidos ao usuário continuam em português.
