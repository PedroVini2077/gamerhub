# 📋 GamerHub — Backlog & Roadmap

> Lista viva do que **queremos fazer mas ainda não foi feito** — geralmente
> porque é grande, arriscado ou depende de decisão. Nada aqui está pronto.
> Conforme as coisas forem sendo feitas, movemos para o `README.md` (o que
> existe) e marcamos/removemos daqui.
>
> Legenda de status: ⬜ a fazer · 🟡 em andamento · ✅ feito (mover pro README)
> Prioridade: 🔴 crítico · 🟠 importante · 🟢 recomendado · 🔵 futuro

---

## 🔴 Crítico

- ✅ **Escalada de privilégio em `profiles`** — qualquer usuário logado conseguia
  se auto-promover a `owner` / se auto-desbanir via UPDATE direto. Corrigido com
  trigger-guarda `guard_profile_privileged_cols` + RPC `admin_set_role`.
  *(feito — documentar no README quando consolidar a seção de segurança)*

---

## 🟠 Importante

### Banco / Segurança
- ⬜ **Ativar proteção contra senha vazada (HIBP)** no Auth do Supabase.
  *Ação manual no painel (Authentication → Policies) — precisa do dono.*
- ⬜ **Mover extensão `pg_net`** do schema `public` para um schema dedicado.
- ✅ **Endurecer INSERT de `notifications`** — feito: notificações de like/
  comentário agora são geradas por trigger SECURITY DEFINER
  (`notify_post_like` / `notify_post_comment`), respeitando notif_likes/
  notif_comments; policy "sempre-true" removida e INSERT direto do cliente
  retirado de `PostCard`/`CommentSection`. *(documentar no README)*

### Frontend / Arquitetura
- ⬜ **Camada de Services (`src/services/`)** — migrar **gradualmente** todo o
  acesso ao Supabase (hoje espalhado nas páginas/componentes) para serviços por
  domínio: `authService`, `profileService`, `postService`, `communityService`,
  `liveService`, `keyService`, `adminService`, `ownerService`, `storageService`.
  Objetivo: desacoplar UI de dados, centralizar tratamento de erro, facilitar
  testes. Fazer arquivo por arquivo, começando por `postService`/`profileService`.

---

## 🟢 Recomendado

### Quebrar arquivos grandes (sem mudar comportamento/visual)
- ⬜ **`Admin.jsx` (1591 linhas)** → `components/admin/*` (UsersPanel, PostsPanel,
  LivesPanel, KeysPanel, NotifsPanel, LogsPanel, SuperAdminPanel).
- ⬜ **`Owner.jsx` (906)** → `components/owner/*` (um arquivo por aba).
- ⬜ **`Lives.jsx` (603)** → `LivePlayer`, `ChatPanel`, `ModPanel`, `LivesList`.
- ⬜ **`Login.jsx` (416)** → `LoginForm`, `RegisterForm`, `ForgotForm`.

### Banco / Performance (impacto cresce com o volume — hoje é pequeno)
- ⬜ **`auth_rls_initplan`**: envolver `auth.uid()` em subquery
  `(select auth.uid())` nas ~43 políticas RLS restantes, para o Postgres avaliar
  uma vez por query em vez de por linha. *(já aplicado nas políticas novas)*
- ⬜ **`multiple_permissive_policies`**: consolidar políticas permissivas
  duplicadas por tabela/ação (`posts`, `comments`, `community_posts`,
  `admin_logs` SELECT, `site_config` SELECT, etc.).
- ⬜ **Listagem de buckets públicos** (`avatars`, `post-media`): restringir a
  policy de SELECT do `storage.objects` para não permitir listar todos os
  arquivos (o acesso por URL pública continua). Validar que não quebra exibição.

### Qualidade de código
- ⬜ Consolidar helpers duplicados: força de senha (`Login`+`AuthConfirm`),
  cálculo de idade (`UserProfile`+`Header`), data mínima de nascimento
  (`Login`+`Profile`), regex de username (`useAuth`+`Login`).
- ⬜ Padronizar tratamento de erro nas queries (junto com a camada de services).
- ⬜ Padronizar senha mínima (hoje 6 em `Settings`, 8 em `Login`).
- ⬜ Skeletons de loading no lugar de "..." em texto.

---

## 🔵 Futuro

- ⬜ **Cache de dados** (React Query ou SWR): dedupe de requests, invalidação,
  sincronização entre componentes.
- ⬜ **Paginação / virtualização** em listas longas (usuários, logs, posts, chat).
- ⬜ **Migração para TypeScript** (introduz a pasta `types/`).
- ⬜ **Testes** (unitários nas regras de XP/ranks e RLS; E2E nos fluxos críticos).
- ⬜ **Soft delete** de posts (campo `deleted_at` em vez de delete físico).
- ⬜ **2FA** no login.
- ⬜ Afinar detecção de ban (hoje realtime + polling de 20s como fallback).
- ⬜ Exportar logs de auditoria (CSV) no painel do dono.

---

## 💡 Ideias soltas (a avaliar)

> Espaço pra jogar ideias de feature que surgirem, sem compromisso. Quando
> decidir fazer, promover pra uma seção acima com prioridade.

- _(adicionar aqui conforme surgirem)_
