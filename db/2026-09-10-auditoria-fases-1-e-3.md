# `[10/09/2026]` Auditoria — FASE 1 (Frontend) e FASE 3 (Banco)

> As duas estavam **paradas desde 05/09** e eram item 🟠 do backlog. Este
> relatório é separado do `2026-09-10-auditoria-seguranca.md` de propósito:
> aquele é a auditoria de segurança pedida pelo dono; este é o plano de 4 fases
> do §6.

## Honestidade sobre o método — leia isto antes dos resultados

Duas coisas que este relatório **não** é:

- **não é leitura arquivo a arquivo.** A Fase 1 foi feita por varredura
  dirigida: para cada item da lista do §6 escrevi uma consulta, rodei sobre os
  **275** arquivos de código de `src/` (fora testes), e **abri à mão só o que a
  varredura acusou**. Onde a varredura é fraca eu digo abaixo;
- **não é a Fase 2 nem a Fase 4.** Essas foram cobertas hoje pelo outro
  relatório (SEC-007 a SEC-010).

**Dois dos meus próprios números estavam errados no caminho, e os dois foram
corrigidos antes de virarem "achado".** Está escrito porque é o método que
importa — o número solto é que engana.

---

## FASE 1 — Frontend

### O que passou, com o que foi medido

| Item do §6 | Resultado |
| --- | --- |
| `npm run build` | limpo |
| `npm run lint` | **0 erros**, 13 warnings (mesmo número de antes) |
| `npx vitest run` | **569 de 569** |
| `dangerouslySetInnerHTML` / `eval` / `new Function` | **nenhum** |
| `innerHTML` | 1 ocorrência, **auditada e segura** — ver abaixo |
| `target="_blank"` sem `rel` | **nenhum** |
| `window.confirm` / `prompt` / `alert` | **nenhum** (só a menção no comentário do `ReasonModal`, que existe para dizer que o substitui) |
| emoji na UI | **nenhum** |
| `setInterval` sem `clearInterval` | **nenhum** |
| canal de realtime sem `removeChannel` | **nenhum** |
| botão só-ícone sem nome acessível | **nenhum** |

### O `innerHTML` — por que ele é seguro, e não "parece seguro"

`lib/supabase.js:23` monta uma tela de erro com `document.body.innerHTML`. A
única interpolação é `${msg}`, e `msg` é construída de **duas strings
literais** do próprio arquivo (`'VITE_SUPABASE_URL'` e `'VITE_SUPABASE_ANON_KEY'`).
Nenhum dado de usuário, de URL ou de banco chega ali — o bloco roda *antes* de o
cliente Supabase existir.

### O `<iframe src>` — o caso que merecia olhar de perto

`EmbedPlayer.jsx` monta `iframeSrc` por interpolação:
`https://www.youtube.com/embed/${info.id}` e
`https://player.twitch.tv/?channel=${info.id}&...`.

Host fixo, mas **`info.id` entra sem codificação** — então a pergunta certa é se
o parser deixa passar caractere que desvie o destino. Não deixa, e isso é
leitura das regexes de `lib/embed.js`, não dedução:

| Provedor | Classe capturada |
| --- | --- |
| YouTube | `[a-zA-Z0-9_-]{11}` |
| Twitch VOD / TikTok | `\d+` |
| Twitch canal / clipe | `\w+` |
| Instagram | `[\w-]+` |

Nenhuma aceita `/`, `?`, `#`, `:` ou `@`. Não há como sair do caminho nem trocar
o host.

### O que foi CORRIGIDO: duas corridas de `useEffect`

A varredura achou 13 efeitos que buscam dado com dependência variável e sem
guarda de cancelamento. **Onze eram falso positivo** — canais de realtime, que
têm `removeChannel` e não são corrida de fetch. Sobraram duas:

- **`useBloqueioDeLogin`** — a pessoa está bloqueada, o intervalo de 8 s dispara,
  e ela troca o e-mail **durante a ida ao servidor**: a resposta do e-mail
  antigo volta e pinta a tela como se fosse do novo. `clearInterval` para o
  relógio, não a consulta que já saiu. Estado de bloqueio errado é pior do que
  nenhum — manda investigar a conta errada (§1.5);
- **`FeatureGate`** — o mesmo com a `flag`. A janela é bem mais estreita (a flag
  costuma ser fixa por montagem), mas a guarda custa uma linha e o erro seria
  mudo.

Corrigidas as duas com a mesma guarda (`let valendo = true` + `if (!valendo) return`).
Corrigir a **classe**, não o caso (§1.3).

### O número que eu quase reportei errado

A primeira varredura de acessibilidade acusou **25 botões só-ícone sem nome
acessível**. Fui conferir três antes de escrever, e os três eram falso positivo:
`LivesPanel` tem o texto *"Atualizar"* dentro de `{}`, `DecisionButton` recebe
`{children}`. Meu filtro removia `{...}` junto com as tags e enxergava um botão
vazio onde havia texto.

Refeito com critério estrito, o número caiu para **1** — e esse um também tinha
`{rotulo}`. **O real é zero.**

Fica registrado porque 25 achados falsos de acessibilidade teriam custado uma
sessão inteira consertando o que não estava quebrado.

### O que a Fase 1 NÃO cobriu

- **Rules of Hooks** foi verificada pelo `eslint-plugin-react-hooks` (0 erros),
  não por leitura. Os 13 warnings restantes são `exhaustive-deps` e
  `set-state-in-effect` — nenhum virou bug nesta varredura, e nenhum foi lido
  um a um;
- **validação de input e estados de loading/erro** por tela: não foi feita tela
  a tela. Foi coberta só onde a varredura de outros itens passou por perto;
- **checagem de permissão só no cliente**: a evidência forte aqui não veio da
  Fase 1 e sim dos testes em `ROLLBACK` do outro relatório, que exercitaram os
  caminhos de escrita direto no banco, sem passar pela tela.

---

## FASE 3 — Banco

### O inventário, medido agora

| | |
| --- | --- |
| tabelas em `public` | **29** |
| **RLS desligada** | **nenhuma** |
| policies | **79** |
| funções `SECURITY DEFINER` | **77** |

### Policies por comando

- **sem policy de SELECT: nenhuma.**
- **sem policy de UPDATE: 14.** Não é achado — é o estado conhecido, e ele já
  tem trava: `src/lib/tabelasSemUpdate.js`. **Conferi a lista da trava contra o
  banco linha a linha: idênticas.** É exatamente o tipo de deriva que a Fase 4
  procura, e aqui ela não existe.
- **sem policy de DELETE: 14.** Todas são append-only (`admin_logs`,
  `policy_acceptances`) ou só se apagam por RPC (`profiles`, via
  `delete_own_account`). **Cruzei com o inventário de `delete()` do frontend:
  nenhuma das 10 tabelas que o site apaga está nesta lista** — ou seja, não há o
  caso "a tela apaga e a policy não existe", que foi o que quebrou a moderação
  de comentário por meses.

### Índices

- **FK sem índice de cobertura: zero.**
- **36 índices com `idx_scan = 0`**, e o `get_advisors` os reporta como
  `unused_index` (nível INFO).

  **Não são achado, e derrubá-los seria erro.** A razão está medida: `posts` tem
  188 linhas, `profiles` tem 5, `reports` tem 2. Em tabela desse tamanho o
  planejador escolhe varredura sequencial **e está certo** — o índice não é
  inútil, é para quando o site crescer. `idx_scan = 0` aqui mede **falta de
  volume**, não falta de utilidade.

  > Vale como observação sobre a própria §6.1: a consulta
  > `where idx_scan = 0` está na bateria de faxina, e **neste projeto ela
  > devolve quase todos os índices**. Enquanto o volume for este, ela não é
  > acionável.

### O que foi CORRIGIDO: as estatísticas nunca tinham sido coletadas

O achado real da Fase 3, e ele apareceu porque um número era impossível:
`pg_stat_user_tables` dizia que `profiles` tinha **0 linhas** — e `profiles`
tem **5**.

Conferido: `last_analyze` **e** `last_autoanalyze` eram **NULL**. A tabela nunca
tinha sido analisada. O motivo é o próprio limiar do autovacuum
(`autovacuum_analyze_threshold` = 50 + 10% das linhas): com 5 linhas e pouca
escrita, `profiles` nunca chegou perto de disparar.

**Por que isso importa mais nesta tabela do que em qualquer outra:** `profiles`
é lida em **toda policy de RLS** — `role_rank((SELECT role FROM profiles WHERE
id = auth.uid()))`. São **29.013 varreduras sequenciais** acumuladas nela.
Enquanto são 5 linhas, o plano seria o mesmo de qualquer jeito; o problema é que
o planejador continuaria acreditando em "0 linhas" conforme o site crescesse.

`ANALYZE` em 10 tabelas. Não altera dado nenhum — só estatística. Resultado:

```
profiles       0 -> 5
notifications  0 -> 21
reports        0 -> 2
post_likes     0 (esta estava certa: a tabela está vazia mesmo)
```

### Advisors

- **security:** nenhum aviso novo (os 3 `anon` + 48 `authenticated` +
  HIBP são o estado conhecido, já auditado no outro relatório).
- **performance:** só os 36 `unused_index` de nível INFO, tratados acima.
  Nenhum WARN, nenhum ERROR.

---

## O que ficou aberto

- os **13 warnings de lint** não foram lidos um a um;
- **validação de input tela a tela** (Fase 1) — não feita;
- a consulta de índice não usado da §6.1 é **inócua neste volume**; se o dono
  quiser um sinal útil de índice, ele só existe depois de tráfego real.
