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
**15 itens abertos** (+ 1 ideia sem compromisso)

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
> **Fechado com a permissão que você deu** ("pode fazer todas elas"): o
> "Carregar mais" do painel. Escolhi a saída mais correta das três — cada
> sub-aba pagina a si mesma — e não a mais barata, porque as outras duas
> deixavam o clique podendo não mudar nada. Custo: uma consulta a mais na carga
> inicial, dentro do mesmo `Promise.all`.
>
> **Viraram decisão** (§6.2 regra 4): resolução adaptativa em vez de `dpr` fixo,
> e o brilho do título por `opacity` → [DECISOES.md](docs/DECISOES.md).
>
> **Esperando você:** três decisões de custo (HIBP, plano Team, sair do Gmail),
> a escolha do React Query, o desenho do aviso na landing, repostar um vídeo e
> repetir o PageSpeed do desktop no preset padrão.

---

## 🟠 Importante — precisa de ação ou decisão do dono

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

- ⬜ `[29/08]` 🟢 **Confirmar que o plano B da moderação de vídeo salva o caso
  real.** *O erro do dono foi capturado, a mensagem que o descrevia estava
  errada, e o caminho alternativo foi construído e travado. Falta um vídeo de
  verdade passar por ele.*

  **O que o aviso na tela finalmente disse** (08:13 de 29/08):
  `o navegador não decodificou o arquivo (tipo: video/mp4)`.

  **E essa frase não era confiável — o erro era meu.** `video.src = url` já
  inicia a carga; logo abaixo havia um `video.load()`, que **aborta a carga em
  andamento**. Um `MEDIA_ERR_ABORTED` era relatado como problema de codec. A
  mensagem única cobria os quatro `MediaError`, que têm causas opostas: 1 é bug
  nosso, 2 é a fonte, 3 é o arquivo, 4 é o codec.

  | Correção | Efeito |
  | --- | --- |
  | `load()` redundante removido | tira a causa que o próprio erro podia ter |
  | manipuladores antes do `src` | o `onerror` deixa de ser registrado depois de a carga começar |
  | `lib/erroDeMidia.js` | a mensagem passa a trazer o código real e o texto do navegador |
  | **plano B pela URL do storage** | se o arquivo local for recusado, a extração é repetida a partir do vídeo que acabou de subir |

  O plano B é o conserto de verdade: todas as causas plausíveis para o `<video>`
  recusar um `blob:` têm a mesma saída — a mídia **já está publicada**, e o
  navegador trata a URL dela como mídia comum, igual à que ele toca no feed.
  Custo: um download a mais, só quando o caminho local já falhou.

  Travado em `e2e/quadros-de-video.mjs`, que agora grava o vídeo fabricado em
  disco, serve por HTTP, extrai pela URL e apaga o arquivo. Provado nos dois
  sentidos.

  **Ação do dono:** postar um vídeo. Três desfechos, e todos são informação:

  | O que aparece | O que significa |
  | --- | --- |
  | nenhum aviso | passou — pelo arquivo local ou pelo plano B |
  | aviso com `arquivo local: … \| storage: …` | falhou nos dois; o vídeo é indecodificável para aquele navegador, e **também não toca no feed** dele |
  | aviso com um motivo só | caso novo — o motivo diz onde olhar |

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
