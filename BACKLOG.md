# 📋 Backlog

> **Isto é um checklist, não um diário.** Só o que falta fazer.
>
> - O que foi **decidido** ou **descartado** vai para [`docs/DECISOES.md`](docs/DECISOES.md).
> - O que já foi **feito sai daqui.** O PR, o `git log` e os relatórios em
>   `db/AAAA-MM-DD-*.md` guardam o histórico — repetir aqui só faz a lista
>   inchar até ninguém conseguir ler.
> - Toda linha leva **data** `[DD/MM]` de quando entrou. Sem data não dá para
>   ver o que envelheceu.
>
> Prioridade: 🔴 crítico · 🟠 importante · 🟢 recomendado · 🔵 futuro

**Última conferência contra o sistema:** 23/08/2026 · **18 itens abertos**
(+ 1 ideia sem compromisso)

---

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[23/08]` **Trocar a senha da conta de teste.** Ela foi combinada por chat
  e ficou no histórico da conversa. Conta descartável e sem privilégio, então
  não é urgente — mas é higiene. **Ao trocar, atualizar o secret
  `E2E_PASSWORD`** no repositório, senão o job de fluxos passa a falhar.
- ⬜ `[23/08]` **Usuário banido não tem canal para pedir revisão.** A
  `BannedScreen` mostra o motivo e desloga em 6s: sem botão, sem formulário,
  sem contato. `request_unban` exige `role = 'admin'`, ou seja, só um admin
  abre o pedido em nome de outra pessoa — coerente com a hierarquia, mas deixa
  o banido sem saída. *Mexe em quem pode chamar a RPC: pede aprovação antes.*
- ⬜ `[22/08]` **Proteção contra senha vazada (HIBP).** Só no plano Pro
  (~US$25/mês). Decisão de custo.
- ⬜ `[21/08]` **Migração para TypeScript.** Grande, decisão do dono.

## 🟠 Importante — dá para fazer

- ⬜ `[23/08]` **As Edge Functions não estão versionadas no git.** As oito vivem
  só no Supabase: sem histórico, sem revisão, sem rollback. A correção da
  brecha da `send-email` (23/08) existe hoje em um lugar só. Trazer para
  `supabase/functions/` — e aí o portão de documentação do CI passa a cobri-las
  de verdade.
- ⬜ `[23/08]` **Apagar `debug-hf` e `cleanup-expired-posts` pelo dashboard.**
  As duas já estão **neutralizadas** (corpo devolvendo 410, `verify_jwt`
  ligado, nada mais é chamado) e o trabalho da segunda virou
  `public.cleanup_expired_posts()` no cron. Falta só o apagar de verdade —
  o MCP não apaga Edge Function. *Supabase → Edge Functions → ⋯ → Delete.*
- ⬜ `[23/08]` **Migrar o envio de email para fora do Gmail pessoal.** Hoje usa
  nodemailer com uma conta Google dedicada — melhor que a conta pessoal, mas o
  limite (~500/dia), o risco de o Google travar por envio automatizado, e a
  falta de painel de entrega continuam. Com domínio próprio (~R$40/ano) +
  Resend vira `nao-responda@…`; sem domínio, o Brevo é a opção. *Não é urgente
  com 3 usuários.*

## 🟢 Recomendado

- ⬜ `[23/08]` **Medir prints de jogo no `violence/graphic`.** O piso está em
  0.80, escolhido sem dado. Como esse caminho **só enfileira e nunca oculta**,
  errar gera fila maior — não censura. Por isso deixou de ser pré-requisito.
- ⬜ `[23/08]` **Conferir a cota do Sentry depois do primeiro mês.** Free são
  5.000 eventos/mês; estourando, ele **descarta em silêncio** — a mesma classe
  de falha que ele existe para acabar. Com 3 usuários não chega perto.
- ⬜ `[22/08]` **Migrar `Admin.jsx` para React Query.** Resolveria de verdade os
  `exhaustive-deps` suprimidos. **Continua travado:** o E2E autenticado usa
  conta comum de propósito (é assim que ele prova que `/admin` é negado), então
  o painel segue sem cobertura de navegador. Destravaria com uma segunda conta
  de teste, com cargo de admin — decisão pendente, porque uma conta de staff
  automatizada é superfície de ataque nova.
- ⬜ `[20/08]` **Denúncia criada não gera log de auditoria.** Decisão consciente
  (qualquer um denuncia, e logar inflaria a trilha) — reavaliar se a moderação
  sentir falta. Ver [DECISOES.md](docs/DECISOES.md).
- ⬜ `[22/08]` **Moderação de vídeo.** Adiada a pedido, **e não é cara**: dá
  para extrair frames com `<video>` + `canvas` no navegador e mandar pela
  moderação de imagem que já existe. Custo zero, e herda de graça a cobertura
  de gore e automutilação.

## 🔵 Só quando o volume crescer

> Nenhum destes é dívida. São decisões **corretas para 3 usuários** que deixam
> de ser corretas em outra escala. Registrados para não serem redescobertos
> como se fossem problema.

- ⬜ `[jun]` **RPC de engajamento agregado.** `attachEngagement` traz as linhas
  de `post_likes`/`comments` e conta no cliente. Trocar por agregação no banco
  quando um post passar dos milhares de curtidas.
- ⬜ `[jun]` **Presence num canal global único** (`gamerhub-presence`).
  Revisitar se "online agora" passar de algumas centenas.
- ⬜ `[jun]` **Paginação / virtualização** em listas longas (usuários, logs, chat).
- ⬜ `[jun]` **Mídia no Cloudflare R2** — solução definitiva de egress se crescer.
- ⬜ `[21/08]` **2FA no login.**
- ⬜ `[21/08]` **Afinar detecção de ban** (hoje realtime + poll de 60s de reserva).

## 💡 Ideias registradas, sem compromisso

- 💡 `[23/08]` **Área própria de moderação de live, estilo YouTube Studio.** O
  incômodo é real: chat é ao vivo e efêmero, e a fila de moderação é assíncrona
  — quando o admin abre o painel, a live já acabou. As ferramentas que importam
  ali já existem no `ModPanel`, dentro da live. É feature nova, não é
  prioridade.

---

## Como esta lista é conferida

Documento envelhece; o sistema não mente (`CLAUDE.md` §1.4). Antes de confiar
em qualquer linha daqui, conferir na fonte:

| Pergunta | Onde está a verdade |
| --- | --- |
| Essa extensão / tabela / função ainda existe? | consulta ao Supabase |
| Esse arquivo ainda tem esse problema? | `grep` no código |
| Isso já não foi feito? | `git log -S'trecho'` e os PRs |

Na conferência de 23/08 essa checagem encontrou **cinco itens listados como
abertos que já estavam feitos** e três duplicados 2–3 vezes. Se a lista voltar
a passar de ~25 itens, é sinal de que precisa de outra conferência.
