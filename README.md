# 🎮 GamerHub

Rede social para gamers: feed, mural da comunidade, lives com chat ao vivo,
ranks e XP. React + Vite no front, Supabase no back, Vercel no deploy.

**No ar:** https://gamerhub-nine.vercel.app

---

## 📚 Onde está cada coisa

Este README responde **o que é** e **como rodar**. O resto mora em `docs/`,
separado por assunto — assim nada vira um paredão de 1.000 linhas.

| Arquivo | Para quê |
| --- | --- |
| [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) | Estrutura de pastas, rotas, camada de services, convenções de código |
| [`docs/FUNCIONALIDADES.md`](docs/FUNCIONALIDADES.md) | O que cada tela faz, hierarquia de cargos, XP, lives, painéis |
| [`docs/MODERACAO.md`](docs/MODERACAO.md) | Denúncias, lista de palavras, IA, fila, infrações e suspensão |
| [`docs/BANCO.md`](docs/BANCO.md) | Tabelas, RPCs, RLS, storage, realtime, custo de banda |
| [`docs/SEGURANCA.md`](docs/SEGURANCA.md) | O que protege o quê, e por quê |
| [`docs/OPERACAO.md`](docs/OPERACAO.md) | **Quando algo quebra.** Monitoramento, site fora do ar, CI |
| [`docs/DECISOES.md`](docs/DECISOES.md) | O que foi decidido e o que foi **descartado**, com o motivo |
| [`BACKLOG.md`](BACKLOG.md) | O que falta fazer — só isso, é um checklist |
| [`CLAUDE.md`](CLAUDE.md) | Como o Claude deve trabalhar neste projeto |
| [`supabase/functions/`](supabase/functions/README.md) | As oito Edge Functions, e por que este espelho pode mentir |
| `db/AAAA-MM-DD-*.md` | Relatórios de auditoria, com o que foi achado e como foi provado |

---

## 🌐 Visão geral

O GamerHub é uma rede social temática para gamers, com estética "neon/cyber"
(tema escuro, verde-neon, roxo e ciano). Visitantes não logados chegam a uma
**landing page institucional** animada com cena 3D; após criar conta e confirmar
o email, acessam a plataforma completa.

Dentro da plataforma, o usuário pode criar posts com texto, imagens, vídeos,
áudio (upload ou gravado) e embeds de YouTube/Twitch/TikTok; interagir via
likes e comentários com suporte a threads; participar do **mural da comunidade**
(mensagens, imagens e reações); assistir e moderar **lives** com chat ao vivo,
incluindo uma seção de **lives de jogadores** (Gameplays / Reacts / Outros);
resgatar **keys** e ver **promoções** de jogos; e evoluir num **sistema de
XP/ranks** com 7 tiers.

A operação é sustentada por uma hierarquia administrativa de quatro níveis
(`user` → `admin` → `super_admin` → `owner`), cada um com poderes crescentes,
toda ação sensível registrada em **logs de auditoria** e protegida por funções
`SECURITY DEFINER` no Postgres.

---

---

## 🧱 Stack & dependências

**Runtime/produção**

| Dependência              | Versão | Uso                                              |
| ------------------------ | ------ | ------------------------------------------------ |
| `react` / `react-dom`    | 19.x   | UI                                               |
| `react-router-dom`       | 7.x    | Roteamento SPA                                   |
| `@supabase/supabase-js`  | 2.x    | Auth, Postgres, Realtime, Storage                |
| `framer-motion`          | 12.x   | Animações (transições, listas, tabs, landing)    |
| `@react-three/fiber`     | 8.x    | Cena 3D da landing (Canvas/WebGL)                |
| `three`                  | 0.x    | Geometrias e materiais 3D                        |
| `@tanstack/react-query`  | 5.x    | Cache de dados, dedupe de requests, invalidação  |
| `lucide-react`           | 1.x    | Ícones de UI                                     |
| `react-icons`            | 5.x    | Ícones de marca (Discord/Twitch/YouTube — fa6)   |
| `react-hot-toast`        | 2.x    | Toasts/notificações                              |

**Build/dev:** Vite 8, Tailwind 3, PostCSS/Autoprefixer, ESLint 10
(`eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`), Vitest.

**Infra:** Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) ·
Deploy na Vercel (`vercel.json` com rewrite SPA e headers de segurança).

---

---

## ▶️ Como rodar

**Pré-requisitos:** [Node.js](https://nodejs.org) 18+ (recomendado 20+) e npm,
[Git](https://git-scm.com) e uma conta no [Supabase](https://supabase.com)
(plano Free serve) para criar o backend.

**1. Clonar o repositório**

```bash
git clone https://github.com/PedroVini2077/gamerhub.git
cd gamerhub
```

> Via SSH: `git clone git@github.com:PedroVini2077/gamerhub.git`

**2. Instalar dependências**

```bash
npm install
```

**3. Configurar as variáveis de ambiente** (ver [seção abaixo](#variáveis-de-ambiente)) —
criar o `.env` na raiz com a URL e a anon key do seu projeto Supabase.

**4. Recriar o banco** (se for um projeto Supabase novo): aplicar o
`DATABASE_SCHEMA_BACKUP.sql` no SQL Editor do Supabase — ele recria tabelas,
RLS, funções, triggers e índices. Buckets de storage e publicação realtime
estão documentados no fim do arquivo (criar pelo dashboard).

**5. Rodar**

```bash
npm run dev       # ambiente de desenvolvimento (Vite) — http://localhost:5173
npm run build     # build de produção -> dist/
npm run preview   # serve o build localmente
npm run lint      # ESLint
npm test          # Vitest — testes unitários da lógica pura (run único)
npm run test:watch# Vitest em modo watch
```

> **Testes:** a lógica pura crítica (XP/ranks, força de senha, idade, parsing de
> embed, formatação) tem cobertura unitária em `src/lib/__tests__/`. São testes
> sem DOM/rede — rápidos e determinísticos — que travam o comportamento correto
> contra regressões. Rodar `npm test` antes de entregar mudanças nessa lógica.

### Variáveis de ambiente

Criar um `.env` na raiz:

```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> ⚠️ O cliente usa **apenas a anon key** (pública por design). Toda a segurança
> de dados depende das políticas **RLS** e das funções `SECURITY DEFINER` no
> Supabase.

---
