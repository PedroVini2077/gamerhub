# GamerHub — Notas do projeto

## Regras de trabalho (preferências do dono)

- **SEMPRE testar antes de entregar.** Rodar build, e quando houver lógica de
  banco/RPC, testar no Supabase (de preferência em transação com ROLLBACK para
  não sujar produção). Caçar edge cases e brechas *antes* de entregar, não
  depois. O dono cansou de gastar tempo resolvendo erros que deveriam ter sido
  pegos antes.
- **Sempre responder em português.**
- **Trabalhar sempre na branch `main`.**
- Quando criar scripts de teste avulsos: rodar, e se passar, **apagar** — não
  commitar script de teste.

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Supabase (project_id `yuqbdcoljlvncxdnesxk`)
- Acesso a tabelas sensíveis via funções `SECURITY DEFINER` (RLS restritiva)

## Convenções de UI

- Modais estilizados via `createPortal`, fundo `rgba(0,0,0,0.92)`, card
  `bg-dark-800 rounded-2xl`, animação `animate-fade-up`. Evitar `window.prompt`
  / `window.confirm` para ações do usuário — usar modais no estilo do site.
- Tipografia mono para dados técnicos, `font-display` para títulos.
- **Animações**: usar Framer Motion com as variantes compartilhadas em
  `src/lib/motion.js` (`fadeTab`, `gridContainer`/`gridCard`, `listContainer`/
  `listItem`). Não duplicar variantes — importar de lá. Transição de página
  global via `PageTransition` + `AnimatePresence` no `App.jsx`.
- **Ícones**: Lucide para UI geral; `react-icons/fa6` para marcas (Discord,
  Twitch, YouTube) com as cores oficiais. Evitar emojis como ícones de UI.

## Auditoria periódica do projeto (plano em 3 fases)

Quando o dono pedir "auditoria", "testes do site", "caçar bugs/brechas" ou
similar, seguir este plano em ordem (frontend → backend → banco), uma fase por
vez, e ao fim de **cada** fase entregar um relatório do que foi encontrado e só
aplicar correções após aprovação do dono.

- **FASE 1 — Frontend**: build limpo; lint (`rules-of-hooks`, dead code);
  Rules of Hooks (nenhum hook após early return / condicional); memory leaks
  (subscriptions/timers/realtime sem cleanup); race conditions; validação de
  inputs; estados de loading/erro cobertos; acessibilidade básica.
- **FASE 2 — Backend**: revisar todas as funções `SECURITY DEFINER` (checagem
  de role correta e explícita via `auth.uid()`); validação de parâmetros;
  tratamento de erro; risco de SQL injection; lógica de negócio (ban, bloqueio
  de login, XP).
- **FASE 3 — Banco**: políticas RLS por tabela; publicação realtime correta
  (`supabase_realtime`); índices em colunas filtradas/ordenadas; integridade
  (FKs, cascades); rodar os advisors de segurança e performance do Supabase.

## Sistemas já implementados

- **Bloqueio de login por tentativas** (servidor é única fonte de verdade):
  5 falhas → 15min · cada falha 5–9 → +15min · 10+ → permanente. Contador só
  zera em login bem-sucedido (sem reversão por tempo — punição intencional).
- **Banimento**: `ban_user` / `unban_user` / `request_unban` /
  `approve_unban_request` / `deny_unban_request`. Ban apaga toda atividade
  (posts, comments, community_posts, live_chat). `ban_count` registra
  reincidência. Tela de banido em tempo real (realtime + poll). Admin solicita
  desbanimento, super admin aprova/nega.
