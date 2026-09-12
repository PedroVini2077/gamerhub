# `[12/09]` Auditoria profunda — FASE 0 (inventário) + BLOCO A (superfície de quem não tem conta)

> Retrato de um dia. Ele deve envelhecer — o que vale como estado atual está no
> `SEGURANCA.md` e no banco. Aqui fica **o que foi olhado, com que método, e o
> que foi achado**.

## FASE 0 — o inventário, que é a meta de cobertura

Medido na hora, não copiado de documento (§1.4).

| | |
| --- | --- |
| código em `src/` | 377 arquivos · 39.386 linhas |
| dividido em | `lib` 114 · `components` 178 · `hooks` 43 · `pages` 22 · `services` 17 |
| Edge Functions | 8 |
| tabelas | 29 — **todas com RLS ligada** (0 sem) |
| funções em `public` | 83, das quais **78 `SECURITY DEFINER`** |
| policies | 79, das quais **12 com `USING (true)`** |
| triggers | 30 · FKs | 42 |

### A conta que define o trabalho

| | |
| --- | --- |
| funções **alcançáveis** por `anon` ou `authenticated` | **50** |
| das quais `anon` alcança | **4** |
| alcançáveis **sem `SET search_path`** | **0** ✅ |
| alcançáveis, `DEFINER`, **sem `auth.uid()`** | 7 |
| destas, **sem identidade NEM checagem de papel** | 5 |

**As 50 alcançáveis são a meta do BLOCO B.** Este relatório cobre **7 de 50** —
as 4 que `anon` alcança e as 3 restantes sem `auth.uid()`. As outras 43 usam
`auth.uid()` e ficam para o bloco seguinte.

## BLOCO A — as 7 funções lidas, uma a uma

Corpo lido por inteiro via `pg_get_functiondef`, não `grep` (§6, FASE 2).

| Função | Quem chama | Veredito |
| --- | --- | --- |
| `username_disponivel(text)` | anon | ✅ valida faixa (3–20, regex) antes de consultar. Enumeração de username é inerente a um checador de disponibilidade, e o username já é público |
| `contagem_de_migrations()` | anon | 🔵 devolve só um inteiro. Ver "o que ficou em aberto" |
| `check_login_status(text)` | anon | 🔵 **hoje**, 🟡 no dia em que o contador ligar. Ver abaixo |
| `get_public_profile(text)` | authenticated | ✅ **e conferido contra a política de privacidade** |
| `get_user_xp(uuid)` | authenticated | 🔵 amplificação. Ver abaixo |
| `contato_dados_para_resposta(uuid)` | authenticated | ✅ `is_staff()` na primeira linha |
| `get_blocked_logins()` | authenticated | ✅ `is_super()` na primeira linha |

### `get_public_profile` — a documentação e o sistema CONCORDAM

Vale registrar porque este projeto tem histórico de o contrário. O
`PRIVACIDADE.md` afirma que *"a data em si não é exposta — o perfil público
mostra só a idade"*, e a função devolve
`EXTRACT(YEAR FROM age(p.birth_date))::int`, nunca `birth_date`. As colunas de
perfil gamer (`state`, `platform`, `favorite_games`, `playstyle`) estão
documentadas como opcionais e públicas. **Sem deriva.**

### `check_login_status` — um oráculo sobre uma tabela vazia

Qualquer pessoa, sem conta, pede o estado de bloqueio de **qualquer e-mail** e
recebe `attempts`, `blocked`, `permanent` e `blocked_until`.

**Hoje o impacto é zero, e isso é fato medido, não suposição:** `login_attempts`
tem **0 linhas** — o que confirma pelo lado do banco o item do backlog de que *o
contador de tentativas nunca foi ligado*. A função sempre devolve zeros.

**O que muda quando ele for ligado:** ela passa a dizer a quem ataca exatamente
quando o bloqueio dele expira, e quais e-mails já foram alvo. O conserto natural
é a função devolver só o que a tela precisa (`blocked` e `blocked_until`),
omitindo `attempts` e `permanent` — mas isso **pertence ao item de ligar o
contador**, não a este bloco: mexer agora seria mexer em código morto.

### `get_user_xp` — o custo, não o sigilo

Aceita um uuid arbitrário e roda **cinco `COUNT` mais um `SELECT` de perfil**,
sem checagem de identidade e sem limite de chamada. O XP é público no site, então
não há confidencialidade em jogo; o que há é **amplificação**: uma chamada REST
barata custa seis varreduras.

**Medido:** os três índices que essas contagens usam existem
(`posts(user_id)`, `comments(user_id)`, `post_likes(post_id)`), e o volume é
275 posts · 62 comentários · 0 curtidas. **Hoje é 🔵.** Cresce com o conteúdo, e
o caminho de conserto é agregação materializada — está no backlog como *"RPC de
engajamento agregado"* desde junho.

## BLOCO A — as 12 policies `USING (true)`

Todas as 12 são de **SELECT**. E a descoberta que muda a leitura delas:
`USING (true)` decide a **linha**; quem decide a **coluna** é o privilégio de
tabela. Medido com `information_schema.column_privileges`.

### Quatro correções anteriores CONFERIDAS, e as quatro seguraram

| Tabela | Colunas que `anon` lê | Estado |
| --- | --- | --- |
| `profiles` | **0 de 25** | ✅ o revoke de LGPD segurou |
| `blocked_words` | **0 de 5** | ✅ SEC-004 segurou |
| `game_keys` | 8 de 9 — falta exatamente `key_code` | ✅ SEC-001 segurou |
| `site_config` | 3 de 4 — falta exatamente `updated_by` | ✅ SEC-005 segurou |

### 🟡 ACHADO — três tabelas de LIVE abertas a quem não tem conta

| Tabela | O que `anon` lê |
| --- | --- |
| `live_chat` | `message`, `user_id`, `post_id`, `created_at` — **o histórico inteiro do chat de todas as lives** |
| `live_chat_timeouts` | `user_id`, **`created_by`**, `expires_at`, `post_id` |
| `live_muted` | `user_id`, `post_id` |

**O que dá para fazer:** um `GET /rest/v1/live_chat?select=*` com a chave anônima
— que é pública, está no pacote JS — devolve a conversa inteira. Em
`live_chat_timeouts`, `created_by` diz **qual moderador** silenciou **quem**.

**Por que é achado e não escolha:** `/lives` e `/lives/:id` estão as duas atrás
de `RequireAuth`. **Nenhuma tela que um visitante deslogado alcança lê essas
tabelas** — o acesso de `anon` não serve a nada e nunca serviu.

**Impacto:** conteúdo de conversa legível em massa sem conta, e metadado de
moderação (quem puniu quem) enumerável por qualquer um. Não derruba o site e não
expõe credencial. O `user_id` é uuid opaco para `anon`, porque `profiles` está
revogada — o que limita o estrago, mas é **proteção de segunda ordem**: ela some
no dia em que alguém liberar uma coluna de `profiles` (§1.3, *desconfiar de
proteção acidental*).

**Solução proposta:** `REVOKE SELECT ON live_chat, live_chat_timeouts,
live_muted FROM anon`, mantendo `authenticated`.

**A conferência de dependência, feita ANTES de propor** — é a que este projeto
pulou três vezes e derrubou o site:

| Quem poderia depender | Resultado |
| --- | --- |
| policies que citam as tabelas | 6, **todas de escrita** (admin/dono criam, atualizam, apagam) — revoke de SELECT em `anon` não as toca |
| funções que citam as tabelas | 5, **todas `SECURITY DEFINER`** — rodam como dono, não como `anon` |
| triggers | 4, todos `DEFINER` (`trg_wordlist_*`) |
| publicação realtime | `live_chat` e `live_chat_timeouts` estão publicadas — **quem assina é `authenticated`**, e ele mantém o SELECT |

**NÃO EXECUTADO.** É revoke, e o §7 manda alertar antes; a régua do §6 manda
relatar e esperar em correção que não seja falha explorável de dano imediato.
Esperando a decisão do dono.

### 🔵 O resto das abertas — higiene, sem ação agora

`post_likes`, `comment_likes`, `community_post_likes`, `post_media`,
`community_post_media`: legíveis por `anon` em massa. São grafo social e URLs de
mídia, com uuid opaco do outro lado. Ficam registradas; não valem revoke isolado
antes de decidir a política de leitura pública do site inteiro.

## O que ficou em aberto, e por quê

| Item | Motivo de não tratar agora |
| --- | --- |
| revoke das três tabelas de live | 🟡 **espera decisão** (§7) |
| `check_login_status` devolver menos | pertence ao item de **ligar o contador**; hoje a tabela está vazia |
| `get_user_xp` agregado | 🔵 no volume atual; já existe item no backlog desde junho |
| `contagem_de_migrations` aberta a `anon` | 🔵 devolve um inteiro. Vale perguntar **quem chama** antes de fechar — porta que ninguém usa é porta a fechar, mas fechar a que o CI usa quebra o CI |

## Cobertura declarada (§6, honestidade sobre o método)

- funções `SECURITY DEFINER` alcançáveis: **7 lidas por inteiro de 50**. As 43
  restantes usam `auth.uid()` e são o BLOCO B.
- policies `USING (true)`: **12 de 12** enumeradas, com privilégio de coluna
  medido em todas.
- tabelas sem RLS: **29 de 29** verificadas — nenhuma sem.
- `search_path`: **50 de 50** alcançáveis verificadas — nenhuma sem.
- código em `src/`: **não coberto neste bloco.**

**Este bloco está CONCLUÍDO. A auditoria não está.**
