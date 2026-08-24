#!/usr/bin/env bash
#
# Decide se a Vercel deve construir este commit.
#   exit 0  -> PULA o build
#   exit 1  -> CONSTRÓI
#
# Ligado em `vercel.json` como `ignoreCommand`.
#
# ── Por que existe ─────────────────────────────────────────────────────────
#
# Em 23/08/2026 batemos no teto do plano Free: "Resource is limited — try again
# in 24 hours (more than 100, api-deployments-free-per-day)". Cem deploys num
# dia, com três usuários no site.
#
# A causa não foi mergear demais. Foi que a Vercel constrói a CADA PUSH, em
# QUALQUER branch, mesmo quando o commit não muda um byte do que ela serve.
# O multiplicador real, por PR:
#
#   push inicial na branch          -> 1 deploy de preview
#   cada correção depois do CI      -> 1 deploy de preview cada
#   o merge na main                 -> 1 deploy de produção
#   o `push --force-with-lease` que -> 1 deploy de preview de um conteúdo
#     realinha a branch (CLAUDE.md §8)  IDÊNTICO ao que acabou de ir pra main
#
# São 4 a 6 deploys por PR, dos quais **um** interessa. E no dia 23/08, de
# quatro PRs, um mexeu só em `docs/`, `db/` e `supabase/` — zero linha do que
# a Vercel entrega — e mesmo assim disparou build.
#
# ── Por que pular preview não custa nada aqui ──────────────────────────────
#
# O preview existiria para alguém clicar e olhar. Ninguém olha: quem revisa é
# o CI, que já roda build, lint, 168 testes, as rotas num Chromium de verdade
# e o E2E autenticado com login, publicação e exclusão. O preview é uma
# segunda opinião mais fraca que a primeira.
#
# O que se perde: uma URL clicável por PR. Com 3 usuários, o dono confere na
# produção. Trade aceito e registrado em docs/DECISOES.md.

set -u

BRANCH="${VERCEL_GIT_COMMIT_REF:-}"

# Tudo que entra no bundle ou na configuração que a Vercel serve. Mexeu em
# algum, precisa de deploy. `vercel.json` entra na lista porque headers e
# rewrites só valem depois de um deploy novo.
CAMINHOS_QUE_IMPORTAM=(
  src
  public
  index.html
  package.json
  package-lock.json
  vite.config.js
  tailwind.config.js
  postcss.config.js
  vercel.json
)

# ── 1. Só a main vira site ─────────────────────────────────────────────────
if [ "$BRANCH" != "main" ]; then
  echo "PULANDO: '$BRANCH' não é a main. Quem revisa branch aqui é o CI do"
  echo "GitHub (build + lint + testes + Chromium + E2E autenticado), não o"
  echo "preview da Vercel."
  exit 0
fi

# ── 2. Na dúvida, CONSTRÓI ─────────────────────────────────────────────────
# Se não dá para comparar com o commit anterior (clone raso demais, primeiro
# commit, git indisponível), o certo é construir. Pular por engano deixaria o
# site velho no ar em silêncio — exatamente a classe de falha que o CLAUDE.md
# §1.5 combate. Errar para o lado do build custa um deploy; errar para o lado
# do skip custa o site desatualizado sem ninguém saber.
if ! git rev-parse HEAD^ >/dev/null 2>&1; then
  echo "CONSTRUINDO: não consegui ver o commit anterior, então não dá para"
  echo "afirmar que nada mudou. Na dúvida, constrói."
  exit 1
fi

# ── 3. Mudou algo que a Vercel serve? ──────────────────────────────────────
# `git diff --quiet` sai 0 quando NÃO há diferença — que é justamente o nosso
# "pule". E sai 1 quando há — que é o nosso "construa". O código de saída
# passa direto de propósito.
if git diff --quiet HEAD^ HEAD -- "${CAMINHOS_QUE_IMPORTAM[@]}"; then
  echo "PULANDO: este commit não toca em nada que a Vercel entrega."
  echo "Mudou só documentação, SQL, Edge Function, teste ou CI."
  echo "Conferido em: ${CAMINHOS_QUE_IMPORTAM[*]}"
  exit 0
fi

echo "CONSTRUINDO: mudou algo que vai para o navegador."
git diff --name-only HEAD^ HEAD -- "${CAMINHOS_QUE_IMPORTAM[@]}" | sed 's/^/  /'
exit 1
