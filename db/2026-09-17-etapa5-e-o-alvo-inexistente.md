# Etapa 5: três investigações, zero otimizações — e o vigia que passou a vigiar

**Data:** 17/09/2026

Ele autorizou: *"pode fazer e pode realizar os concertos de otimização"*. A
medição devolveu **nada para consertar** na performance, e um conserto de
verdade em outro lugar. O valor desta rodada está no **porquê** — para ninguém
refazer o caminho.

---

## 1. Minha própria proposta estava errada, e o código desmentiu

Na Etapa 5 eu propus tirar o `vendor-supabase` (203,8 kB) do caminho crítico da
landing, afirmando que o único consumidor no boot era o
`ProvedorDaConfigDoSite`.

**Fui ler antes de mexer, e não é isso.** Quem puxa o chunk é o
`hooks/useAuth.jsx`, que chama `supabase.auth.getSession()` no boot — é ele que
decide entre mostrar a landing ou o feed. Adiar isso não é otimização: é quebrar
a decisão de qual página mostrar.

**Era inferência vestida de fato (§1.1).** Eu tinha visto *um* consumidor e
concluí que era *o* consumidor. Dois `grep` desmentiram.

O que sobra daquele achado é real mas é outra coisa: a **conexão de realtime**
que todo visitante anônimo abre. Isso é cota (§0.2), não byte, e continua como
proposta no `BACKLOG.md`.

---

## 2. O CSS não tem gordura

| | |
| --- | --- |
| CSS total do build | **70,5 kB** bruto |
| CSS **nosso**, escrito à mão | **49,4 kB** |
| sobra do Tailwind, já purgado | ~21 kB |

O `content` do Tailwind cobre `./index.html` e `./src/**/*.{js,jsx}`. Está
correto, e 21 kB para o design system inteiro é purge funcionando.

Os **360 ms** de bloqueio no celular contra **50 ms no PC**, pelo mesmo arquivo,
são **rede** — sete vezes o mesmo byte.

**Extrair CSS crítico foi recusado.** O risco é FOUC — a página aparecer sem
estilo por um instante —, e isso é literalmente *"deixar a landing feia"*.

---

## 3. Separar o `framer-motion` PIOROU, e o portão recusou

Era o único grande sem chunk próprio. Separar parecia ganho de cache óbvio: o
`index` muda a cada deploy, a biblioteca não.

**Medido, mesma ferramenta, antes e depois (§0.3 regra 5):**

| | bruto | gzip |
| --- | --- | --- |
| antes | 739,0 kB | **224,4 kB** |
| depois | 748,5 kB | **228,4 kB** ← estourou |
| teto | 760 kB | **228 kB** |

**Chunk separado comprime pior.** O gzip trabalha com um dicionário por arquivo;
quebrar um arquivo grande em dois faz cada metade perder o que a outra teria
compartilhado.

A troca real: **cache para quem volta, em troca de 4 kB a mais para quem chega
pela primeira vez** — e a primeira visita é exatamente a que o PageSpeed mede em
77. **Revertido**, com o número escrito no `vite.config.js` para ninguém repetir.

> **O número que ninguém tinha olhado:** o carregamento inicial está em
> **224,4 de 228 kB** gzip. **3,6 kB de folga.** Qualquer dependência nova
> estoura o portão.

---

## 4. O conserto de verdade: o alvo inexistente

Este ele liberou explicitamente: *"eu quero liberar o ci invocar o ban_user"*.

### O defeito

O `e2e/portas-do-banco.mjs` mandava `{}` em todas as RPCs. O PostgREST devolve
**404 para função com parâmetro obrigatório** — porque não acha a sobrecarga, e
não porque negou privilégio. O teste contava isso como "revogada".

Quase todas as entradas têm parâmetro. O **"49/49"** provava muito menos do que
parecia.

### A conversa que mudou o desenho

Ele cogitou criar uma conta de teste (`+alguma@gmail.com`) para o CI ter um alvo
real. **Discordei, e a discordância poupou trabalho:** não é preciso conta
nenhuma.

Lido no `pg_proc`, o `ban_user` — a mais perigosa da lista — tem **três**
barreiras antes de qualquer escrita:

| | |
| --- | --- |
| 1 | `EXECUTE` revogado → `401` *(é o que o teste mede)* |
| 2 | `role_rank(v_caller_role) <= 1` → `anon` não tem perfil, `role_rank(NULL)` é **0** |
| 3 | `IF v_target_username IS NULL` → `'Usuario nao encontrado.'` |

Com o UUID zerado (`00000000-…`), que não corresponde a ninguém, mesmo que as
duas primeiras caíssem de uma vez a terceira barra antes de tocar em linha.

> **A conta de teste teria valor para OUTRA coisa** — cobrir o lado
> `authenticated`, que é o buraco que sobrou da SEC-024. Mas ali a conta é a
> parte barata: o custo é **a senha dela virar secret no CI**, e credencial no CI
> é a troca que este projeto já recusou três vezes.

### A exceção que exigiu cuidado

`enviar_mensagem_de_contato` não tem alvo: ela **cria linha**. Se a porta abrir,
o argumento válido vira mensagem de verdade no canal.

O texto dela se identifica — assunto `PORTA ABERTA: esta RPC aceitou chamada
anonima`. Se aparecer no canal, ela é um **alarme a mais**, não um dano: a porta
ter aberto é o problema, e a mensagem é o aviso.

### O resultado, medido contra produção

**12 de 12 respondem `401`** — recusa de privilégio, com a assinatura casando.
Nenhum 404 de assinatura sobrou. O `49/49` passou a significar alguma coisa.

E a leitura do `404` mudou junto: com o argumento certo ele não quer mais dizer
"revogada", e sim *"não existe, ou o nome do argumento mudou"*. A mensagem foi
reescrita para dizer a verdade sobre qual é.

### A trava, provada nas duas metades

| Bug reinjetado | O que aconteceu |
| --- | --- |
| `username_disponivel` (aberta **de propósito**) na lista | **FALHOU** — `ACEITOU CHAMADA ANÔNIMA (HTTP 200)`. Antes do conserto ela passava como *"revogada (nem aparece)"* |
| entrada sem corpo declarado | **FALHOU** — `SEM CORPO na lista`, explicando que `{}` volta a colher o 404 de assinatura |

A segunda guarda existe porque a trava tinha acabado de ser decoração uma vez;
sem ela, acrescentar uma RPC e esquecer o corpo recriaria o defeito em silêncio.

---

## O que NÃO foi feito

- **Nenhuma otimização de performance.** As três investigações apontaram para
  não mexer, e a terceira foi barrada pelo portão de bytes.
- **A metade `authenticated` da SEC-024 continua sem trava automática.**
- **O LCP de 4,6 s no celular continua o que é** — ele é a abertura da marca
  (2.150 ms, somados em `lib/tempoDaAbertura.js`) mais o boot. Mexer nisso
  encosta na identidade, e é decisão dele.
