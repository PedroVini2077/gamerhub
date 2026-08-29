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

**Última conferência contra o sistema:** 29/08/2026, manhã ·
**16 itens abertos** (+ 1 ideia sem compromisso)

> **O que esta rodada fechou** (29/08): a cena 3D deixou de ocupar 99% da thread
> principal enquanto visível — 8.066 ms → 52 ms de bloqueio numa janela de 8 s,
> medido em navegador de verdade e travado no CI; o `HUB` do título (elemento de
> LCP) deixou de animar `text-shadow`, que não roda no compositor; e a falha de
> extração de quadros de vídeo passou a chegar ao `admin_logs` com o motivo, o
> tipo do arquivo e o navegador.
>
> **O buraco encontrado no caminho, e ele era o pior dos três:** `drawImage` com
> um vídeo não decodificado **não lança** — saía um JPEG válido e transparente,
> a IA respondia `score 0`, e o vídeo ficava registrado como **analisado e
> limpo**. Análise falsa é pior que ausência de análise: a ausência aparece como
> pendência, a falsa afirma que alguém olhou.
>
> **A correção que eu tinha declarado e estava pela metade:** o `frameloop` de
> 28/08 resolvia a cena desenhando **fora** da tela, e eu li isso como "o
> problema de desempenho da cena está corrigido". Nunca tinha medido o caso "na
> tela", que era o caro. Registrado no item do chunk 3D.
>
> **Viraram decisão** (§6.2 regra 4): resolução adaptativa em vez de `dpr` fixo,
> e o brilho do título por `opacity` → [DECISOES.md](docs/DECISOES.md).
>
> **Esperando você:** três decisões de custo (HIBP, plano Team, sair do Gmail),
> a escolha do React Query, o desenho do aviso na landing, a saída do "Carregar
> mais", repostar um vídeo e repetir o PageSpeed do desktop no preset padrão.

---

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[29/08]` 🟢 **"Carregar mais" no painel pode não mudar nada na tela.**
  *Achado ao consertar o teste do painel, não relatado por ninguém — mas é um
  no-op visível, e este projeto trata isso como defeito (§1.5).*

  A aba Posts tem duas sub-abas, "Posts ativos" e "Lixeira", e mostra uma por
  vez. **A paginação não é por sub-aba:** `fetchAll` traz os 20 posts mais
  recentes misturados, e `loadMorePosts` traz os 20 seguintes, também
  misturados.

  O botão só aparece na sub-aba **ativos**. Se os próximos posts forem todos
  apagados — provável, porque os antigos costumam estar na lixeira — o admin
  clica, o painel carrega de verdade, e **a lista na frente dele não muda**.
  Foi exatamente o que o CI mostrou: 8 ativos antes, 8 depois, com a paginação
  funcionando.

  **Três saídas, e a escolha é de produto:**

  | Saída | O que muda |
  | --- | --- |
  | Paginar por sub-aba | consulta filtrada por `deleted_at`; mais correto e mais consultas |
  | Mostrar o botão nas duas sub-abas | trivial; o clique passa a fazer sentido em ambas |
  | Rótulo honesto ("carregar mais posts, incluindo lixeira") | o mais barato, e resolve a expectativa sem mexer na lógica |

  Não escolhi sozinho porque muda o que o admin vê. Nada quebra hoje: o botão
  carrega de verdade, e o contador da Lixeira sobe.

- ⬜ `[28/08]` 🟢 **Conferir os pisos novos com o uso real, em algumas semanas.**
  *Não é decisão pendente — a decisão foi tomada em 28/08 e está no ar (v14).*
  `violence` foi aposentada e `violence/graphic` subiu de 0.80 para 0.95. O
  raciocínio inteiro está em [MODERACAO-IA.md](docs/MODERACAO-IA.md).

  **A amostra até agora** (toda a medição que existe, 5 posts):

  | Imagem | `violence` | `violence/graphic` | Fila? |
  | --- | --- | --- | --- |
  | comum (2 posts) | 0.000 – 0.001 | 0.000 | não |
  | "violenta", escolha do dono | 0.834 | 0.414 | não |
  | print de jogo (1 imagem) | — | **0.854** | não (era sim) |
  | prints de jogo (4 imagens) | **0.943** | ≤ 0.943 | não (era sim) |

  **Duas leituras honestas disso.** A boa: o modelo separa muito bem — imagem
  comum dá 0.000 e conteúdo violento sobe para a casa dos 0.8. A que incomoda:
  **nada que medimos até hoje cruzou 0.95**, então a fila de violência está,
  na prática, dormente. Isso é o efeito pretendido para print de jogo, mas
  ainda **não foi provado** que gore de verdade cruza esse piso — e não dá para
  provar postando gore real de propósito.

  Daqui a algumas semanas, olhar os logs e responder:

  | Se… | Então |
  | --- | --- |
  | a fila voltar a encher de print de jogo | 0.95 ainda está baixo |
  | passar gore evidente e a fila seguir vazia | 0.95 está alto — descer para ~0.88, acima do 0.854 medido |

  Onde ler: painel da Supabase → Edge Functions → `moderate-image` → Logs,
  linhas `[moderate-image] ... | notas: ...`.

  > Os dois itens antigos que tinham ficado na fila já foram resolvidos pelo
  > dono no painel — conferido ao fechar a sessão: `moderation_queue` com zero
  > pendentes.

- ⬜ `[29/08]` 🟢 **Descobrir POR QUE o vídeo do dono não rende quadros.**
  *Ainda aberto, e agora com instrumentação em vez de hipótese.*

  **O que está provado (log da Supabase, 29/08 03:19:44 UTC):** a
  `moderate-text` foi chamada para o post do vídeo e a `moderate-image`
  **não foi chamada nenhuma vez**. A falha está no navegador, antes da rede.
  Isto é fato, não dedução.

  **O que NÃO está provado:** qual das causas dispara. Continua desconhecido, e
  nenhuma das correções abaixo foi feita por ser "a provável" — cada uma fecha
  um caminho de falha silenciosa que estava aberto de verdade.

  **O que mudou em 29/08:**

  | Mudança | O que resolve |
  | --- | --- |
  | motivo vai para o `admin_logs` via `falha_de_extracao` | o motivo deixou de viver só num toast de segundos e no Sentry — duas investigações começaram do zero por causa disso |
  | motivo aparece no aviso da tela, e ele dura 12 s | quem publicou consegue dizer a causa sem abrir painel nenhum |
  | quadro em branco passa a ser reprovado | `drawImage` com vídeo não decodificado **não lança**: saía um JPEG válido e transparente, a IA devolvia `score 0`, e o vídeo era gravado como **analisado e limpo** — pior do que não analisar |
  | `load()` + `play()` mudo antes de amostrar | `preload` é dica, e o Safari do iPhone a ignora fora de gesto do usuário — e o gesto já expirou no upload |
  | vigia de 4 s por salto | `seeked` não é garantido; um salto travado consumia os 15 s e levava junto os quadros que já tinham dado certo |
  | exige `videoWidth`/`videoHeight` | sem dimensão, o canvas de 512×512 saía transparente |

  **Ação do dono, e é a única que falta:** repostar um vídeo. Se passar, o log
  mostra `analisadas=3/3`. Se falhar, a causa aparece **na tela e no
  `admin_logs`** com nome — consulta pronta em
  [OPERACAO.md](docs/OPERACAO.md).

- ⬜ `[22/08]` **Proteção contra senha vazada (HIBP).** Só no plano Pro
  (~US$25/mês). Decisão de custo.
- ⬜ `[28/08]` **Contar falha de login de verdade exige plano Team.** A função
  `hook_de_verificacao_de_senha` está no banco, testada e com `EXECUTE` só para
  o `supabase_auth_admin` — mas o *Password Verification Attempt hook* aparece
  cinza no painel: **"Team or Enterprise Plan required"**. O outro caminho
  também está fechado: `auth.audit_log_entries` está vazia, zero linhas desde
  sempre. **O que já está resolvido:** ninguém consegue mais fabricar alerta de
  segurança, e força bruta continua barrada pelo rate limit do próprio GoTrue.
  O que falta é só a contagem para avisar a equipe. Mesma família do HIBP —
  decisão de custo, não de código. Ver [SEGURANCA.md](docs/SEGURANCA.md).

## 🟠 Importante — dá para fazer

- ⬜ `[23/08]` **Migrar o envio de email para fora do Gmail pessoal.** Hoje usa
  nodemailer com uma conta Google dedicada — melhor que a conta pessoal, mas o
  limite (~500/dia), o risco de o Google travar por envio automatizado, e a
  falta de painel de entrega continuam. Com domínio próprio (~R$40/ano) +
  Resend vira `nao-responda@…`; sem domínio, o Brevo é a opção. *Não é urgente
  com 3 usuários.*


## 🟢 Recomendado

- ⬜ `[29/08]` **Repetir o PageSpeed do desktop, agora no preset padrão.**
  *A causa do 58 foi encontrada e corrigida; falta o antes/depois de campo.*

  **O que a rodada de 29/08 achou.** O PageSpeed do dono acusava 31,3 s de
  thread principal, dos quais **30.182 ms em "Other"** — e byte nenhum explicava
  aquilo, porque o custo de uma cena WebGL é por **pixel**. Medido num navegador
  de verdade, janela de 8 s com o Hero na tela:

  | Configuração | Long tasks | Thread bloqueada |
  | --- | --- | --- |
  | como estava (`dpr` até 1,5 + `antialias`) | 88 | **8.066 ms de 8.000 ms** |
  | resolução adaptativa (como está) | 1 | **52 ms** |

  A thread principal ficava 99% ocupada enquanto a cena estivesse visível. Isso
  também explica a contradição dos dois prints do dono: o do celular deu **TBT
  0 ms** porque a cena 3D não sobe abaixo de 1024px — o celular nunca pagou.
  Detalhes em [ARQUITETURA.md](docs/ARQUITETURA.md).

  **O que falta, e por que é do dono:** o print do desktop mostrava
  *"Limitação personalizada"*. Comparar uma medição de preset customizado com
  outra não diz nada (§0.3, regra 5). O pedido é: **PageSpeed, aba Desktop,
  janela anônima**, e comparar com o próximo — sempre no mesmo preset.

  | Onde | Como |
  | --- | --- |
  | **PageSpeed Insights** | `pagespeed.web.dev`, colar a URL, aba Desktop |
  | **Chrome no PC** | F12 → Lighthouse → Desktop + Performance → Analyze page load |
  | **Vercel Speed Insights** | já instalado; é o único que mede usuário real, e o único que responde se a cena incomoda quem TEM GPU |

  O portão do CI continua sendo **byte** (`scripts/orcamento-de-bytes.mjs`),
  porque tempo de laboratório oscila. A exceção nova é `e2e/cena-3d.mjs`, que
  agora barra bloqueio de thread acima de 800 ms — ali a margem é zero contra
  dois mil, não uma porcentagem.

- ⬜ `[29/08]` **`useAuth.jsx` passou de 300 linhas (311) — e é o arquivo de
  maior risco do projeto.** *Esbarrei nele na varredura de tamanho de 29/08,
  fazendo outra coisa. Não dividi na hora e o motivo é explícito: dividir
  `useAuth` não é corte mecânico — ele carrega sessão, perfil, realtime de ban
  e o `signOut`, e quebrá-lo derruba o site inteiro (`CLAUDE.md` §7, arquivo de
  alto risco). O §4 manda dividir arquivo que eu inchei; eu não inchei este.*

  **O corte que parece certo, para quando for a hora:** separar o realtime de
  ban/suspensão (canal + poll de 60 s) do estado de sessão/perfil. São as duas
  responsabilidades que já convivem ali, e a primeira tem teste próprio.
  **Pede aprovação antes** (§7 🟡): mexe em autenticação.

- ⬜ `[28/08]` 🔵 **Emagrecer o chunk da cena 3D — o que sobrou depois de duas
  correções de desempenho.** *A cena 3D FICA (decisão do dono, registrada em
  [DECISOES.md](docs/DECISOES.md)). Isto aqui é BYTE, e byte nunca foi o
  gargalo dela.*

  **`[29/08]` Correção do que este item dizia.** Ele afirmava que o problema de
  desempenho da cena "já foi corrigido" em 28/08, quando o `frameloop` passou a
  desligar fora da tela. Estava **errado pela metade**, e a metade que faltava
  era a maior:

  | Rodada | O que foi corrigido | O que continuava |
  | --- | --- | --- |
  | 28/08 | a cena desenhando 60×/s **depois** de o visitante rolar para longe | ela custava ~92 ms **por quadro** enquanto visível |
  | 29/08 | resolução adaptativa: 8.066 ms → 52 ms de thread bloqueada | — |

  O erro de raciocínio foi olhar só o caso "ninguém está vendo". O caso "está
  na tela" nunca foi medido, e era 99% de ocupação da thread principal.

  **O que sobra, e por que é 🔵:** o chunk continua com 887 kB, e trocar
  `<Canvas>` por `createRoot` + `extend` seletivo vale **−20%** (887 → 707 kB,
  medido com experimento descartável). Isso importa para **download em rede
  lenta** — não para thread principal, que agora está resolvida por outro
  caminho.

  **O custo de fazer:** `createRoot` não traz o tratamento de resize que o
  `<Canvas>` faz sozinho; seria preciso escrever e testar isso. Trabalho real,
  ganho moderado, risco na porta de entrada do site. Fica para quando houver
  folga.

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
- ⬜ `[21/08]` **Migração para TypeScript.** *Rebaixada em 28/08 a pedido do
  dono — fica por último.* Não descartada: quando a hora chegar, a análise de
  28/08 recomenda fazer por fronteira, e não de uma vez. As duas primeiras
  fatias (`src/lib/`, 44 arq · 2.899 linhas; `src/services/`, 9 arq · 994
  linhas) são 22% do código e concentram quase todo o benefício — é onde mora
  toda a conversa com o Supabase e a lógica pura já 100% testada. Gatilho
  sugerido: a próxima migration que renomeie ou remova coluna.
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
