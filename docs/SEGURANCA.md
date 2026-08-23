# Segurança

> O que protege o quê. O site entrega apenas a `anon key` ao navegador — então
> **toda** regra de verdade vive no banco (RLS, CHECK, trigger, ou RPC com
> checagem). Validação no cliente é conveniência, nunca proteção.

## 🔒 Segurança

- Cliente usa **anon key**; a proteção real está no **RLS** + funções
  `SECURITY DEFINER`.
- Hierarquia de cargos **imposta no banco** (não confia só na UI).
- **Guard de `profiles`** (`guard_profile_privileged_cols`): trigger que bloqueia
  qualquer UPDATE em colunas sensíveis (`role`, `banned`, etc.) feito
  diretamente pelo usuário — auto-promoção/auto-desban impossível por UPDATE
  direto na tabela.
- Funções `SECURITY DEFINER` administrativas/owner têm `EXECUTE` **revogado de
  `anon`** (defesa em profundidade): além da checagem interna por `auth.uid()`,
  usuários não autenticados sequer conseguem invocá-las via RPC. Só permanecem
  abertas a `anon` as do fluxo de login (`check_login_status`,
  `register_login_attempt`) e a leitura de XP (`get_user_xp`).
- Notificações geradas por triggers `SECURITY DEFINER` — INSERT direto do
  cliente removido; banidos não burlam filtros via INSERT de notification.
- RLS consolidada: políticas múltiplas permissivas unificadas; bug "banido ainda
  posta" corrigido (INSERT de posts/community_posts era OR'd — agora AND).
- **Hierarquia de moderação imposta no DELETE** (`can_moderate_content`): admin
  não apaga mais conteúdo de super_admin/owner; owner passou a moderar de fato.
  No cliente, os serviços de delete usam `count: 'exact'` e tratam 0 linhas
  como erro real (acabou o "sucesso" falso quando o RLS bloqueia).
- Bloqueio de login server-side; tela de banido em tempo real.
- `auth_rls_initplan`: `auth.uid()` envolto em `(select auth.uid())` em todas
  as políticas — evita re-avaliação por linha.
- Headers de segurança na Vercel (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, etc.).
- Trilha de auditoria de ações sensíveis.

- **Auditoria completa de 21/08/2026** (3 fases, tudo aplicado em produção —
  ver `db/2026-08-21-auditoria-seguranca.md`). Fechou 5 falhas críticas:
  XSS armazenado via link de post (`javascript:` chegava a um `href`),
  injeção de mídia em post alheio, bloqueio de conta por anônimo, censura de
  conteúdo por qualquer usuário logado e leitura da tabela de usuários
  (incluindo `birth_date` e histórico de ban) **sem login**. Advisors de
  segurança: 64 → 42 avisos, 0 erros.
- **URLs externas sempre saneadas** (`lib/url.js` → `safeExternalUrl`): só
  `http`/`https` viram `href`. Vale no cliente **e** no banco (`CHECK`
  constraints em `posts.embed_url`, `game_keys.promo_url`, `post_media.url`,
  `community_post_media.url`) — a anon key permite chamar a REST API direto,
  então validação só no frontend não vale nada.
- **`anon` só enxerga `(id, username)` de `profiles`** — o suficiente para a
  checagem de username duplicado no cadastro. RLS é por linha, não por coluna;
  a restrição correta aqui é privilégio de coluna.
- **Guards de coluna privilegiada** em `profiles`
  (`guard_profile_privileged_cols`) e `posts` (`guard_post_privileged_cols`):
  usuário comum não altera `role`/`banned` nem `hidden_at`/`deleted_at`/
  `user_id`. Ambos com `search_path` fixo.

> A política de segurança e os pontos de melhoria são revisados periodicamente
> pelo plano de auditoria em 3 fases descrito no `CLAUDE.md`.

---


---

[← voltar para o README](../README.md)
