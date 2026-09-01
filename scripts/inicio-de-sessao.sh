#!/usr/bin/env bash
# O GATILHO. Roda sozinho no começo de TODA sessão, via hook SessionStart.
#
# Por que existe: em 29/08 o dono cobrou — "quero algum tipo de gatilho pra vc
# poder ler a documentação e principalmente sua própria memória (CLAUDE.md)".
#
# A parte que decide o formato: naquele mesmo dia eu falhei DUAS vezes com as
# regras escritas, certas, e lidas por mim no começo da sessão. Ou seja, "leia
# o CLAUDE.md" não era o que faltava. O que faltava era o ESTADO REAL na cara:
# o que está aberto, o que mudou, e há quanto tempo cada documento não é tocado
# — porque documento velho não grita, e foi assim que ele apodreceu três vezes.
#
# Este script não dá ordem e não repete regra. Ele mostra fatos, que é o que
# o §1.4 manda: "documento envelhece; o sistema não mente".
set -u
cd "$(dirname "$0")/.." || exit 0

echo "═══ ESTADO REAL DO PROJETO (lido agora, não da memória) ═══"
echo
echo "── Branch e pendências ──"
git status -sb 2>/dev/null | head -8
pend=$(git status --porcelain 2>/dev/null | wc -l)
[ "$pend" -gt 0 ] && echo "  ATENÇÃO: $pend arquivo(s) com trabalho não commitado de uma sessão anterior."

echo
echo "── Últimos 5 commits ──"
git log --oneline -5 2>/dev/null

echo
echo "── Backlog ──"
grep -m1 'itens abertos' BACKLOG.md 2>/dev/null
echo "  (a fila inteira precisa ser relida antes de FECHAR um bloco — §6.2)"

echo
echo "── Há quantos dias cada documento não é tocado ──"
hoje=$(date +%s)
for doc in CLAUDE.md README.md BACKLOG.md docs/*.md docs/regras/*.md; do
  [ -f "$doc" ] || continue
  ts=$(git log -1 --format=%ct -- "$doc" 2>/dev/null)
  [ -z "$ts" ] && continue
  printf '  %4d dias  %s\n' "$(( (hoje - ts) / 86400 ))" "$doc"
done | sort -rn | head -12

echo
echo "── Lembretes que NÃO são opcionais (CLAUDE.md) ──"
echo "  §6.2 camada 3: proibido editar trecho de documento estrutural sem ABRIR"
echo "                 a seção alvo antes. 'Eu lembro o que está lá' já falhou 3x."
echo "  §6.2 destino:  medição -> DESEMPENHO.md · decisão -> DECISOES.md"
echo "                 arquivo novo -> ARQUITETURA.md · o que falta -> BACKLOG.md"
echo "  §2  fechar:    'npm run fim' antes de encerrar. Ele reprova o que sobrou."
echo "  §8  ciclo:     PR + merge + sincronizar a branch são MINHA obrigação."
echo
echo "── O que NENHUM script verifica (§2: 7 dos 13 itens) ──"
echo "  Estas perguntas aparecem aqui e NÃO só no fim de propósito: no fim elas"
echo "  chegam tarde para mudar COMO a coisa foi construída."
echo "  §1.3  Como alguém abusaria disto? Dado forjado, RLS que não cobre um"
echo "        caminho, RPC chamável por quem não devia, corrida, permissão."
echo "  §1.5  Se quebrar de madrugada: o que a pessoa vê? o que fica gravado?"
echo "        qual teste falha? Se as três forem 'nada', não está pronto."
echo "  §2    Todo bug corrigido vira TRAVA — e a trava se prova reinjetando o"
echo "        bug e vendo o teste falhar. Senão é decoração."
echo "  §5    Mexeu em banco/RPC/RLS? Testar em ROLLBACK ANTES da produção."
echo "  §6.1  Faxina no que tocou: código morto, duplicação, egress, cleanup."
echo
echo "── A pergunta, antes de entregar QUALQUER coisa ──"
echo "  \"Quais regras deste projeto se aplicam ao que acabei de fazer — e para"
echo "   cada uma, ONDE ESTÁ A EVIDÊNCIA de que cumpri?\""
echo
echo "  Ela é assim de propósito. \"Estou fazendo tudo?\" se responde com um"
echo "  \"sim\" preguiçoso, e teria deixado passar todas as falhas de 29/08."
echo "  Esta obriga a NOMEAR regra e evidência. Sem evidência nomeada, não"
echo "  cumpri: só acho que cumpri."
echo
echo "  E a segunda, que cobre o que a primeira não vê:"
echo
echo "  \"O que estou afirmando agora que ainda não provei?\""
echo
echo "  Esta ataca a falha mais registrada deste projeto: apresentar INFERÊNCIA"
echo "  como FATO (§1.1). Em 23/08 duas afirmações minhas eram dedução vestida"
echo "  de fato, e eu mesmo tive que corrigir as duas depois."
echo
echo "═══════════════════════════════════════════════════════════"
