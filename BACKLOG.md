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
**23 itens abertos** (+ 1 ideia sem compromisso)

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
> **Fechado também:** o chunk da cena 3D, que era 🔵. Ele deixou de ser "bytes
> para rede lenta" quando o A/B mostrou que a cena responde por 520 ms de thread
> principal e que, depois da resolução adaptativa, esses 520 ms são quase todos
> CARGA. Trocar `<Canvas>` por `createRoot` deu −20,2% de bytes e −18% de thread.
> A justificativa antiga do item (`extend(THREE)`) estava errada — conferida na
> fonte e corrigida em [DESEMPENHO.md](docs/DESEMPENHO.md).
>
> **Viraram decisão** (§6.2 regra 4): resolução adaptativa em vez de `dpr` fixo,
> o brilho do título por `opacity`, e o `<Canvas>` saindo em favor do
> `createRoot` → [DECISOES.md](docs/DECISOES.md).
>
> **Esperando você:** três decisões de custo (HIBP, plano Team, sair do Gmail),
> a escolha do React Query, o desenho do aviso na landing, repostar um vídeo e
> repetir o PageSpeed do desktop no preset padrão.

---

## 🟠 Importante — precisa de ação ou decisão do dono

- ⬜ `[01/09]` 🟡 **Decidir sobre teste de mutação — o que sobrou da auditoria.**
  *A auditoria de mim mesmo foi concluída (partes A a E). Este é o único ponto
  dela que depende de decisão sua, então virou item próprio em vez de manter o
  item inteiro aberto.*

  **O problema:** o padrão de falha nº 3 — *"escrevo teste que não consegue
  falhar"* — é o único do catálogo que continua **sem mecanismo**, e eu o
  repeti duas vezes em 01/09 (a trava de portas RPC e a de banco fora do ar).

  O `varrerFontes` fechou um caso importante: agora a trava estoura se não ler
  arquivo nenhum. Mas ele garante que ela **leu** o código, não que ela
  **detectaria** a mudança errada.

  **O mecanismo que pegaria de verdade é teste de mutação** (Stryker): ele muta
  o código e exige que algum teste quebre. O que ele custa: alguns minutos a
  mais no CI e uma dependência de peso.

  **É decisão de custo sua**, não minha — por isso está escrito aqui em vez de
  já ter sido feito.

  **O resultado da auditoria fica registrado**, e é desconfortável de propósito:
  dos 9 padrões de falha meus, **2 têm mecanismo** (dado de teste sobrando, e a
  varredura que prova que leu). Os padrões 2, 6, 7 e 9 são de julgamento e
  conduta — não existe script que detecte "afirmou sem provar", e fingir que
  existe seria o padrão nº 5 acontecendo uma camada acima.

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

- ⬜ `[29/08]` 🟢 **Conferir a fila `Não analisado` daqui a alguns dias.**
  *Não é pendência de código — o caminho está fechado. É a conferência que diz
  se o número escolhido foi o certo.*

  **O que ficou pronto:** a moderação de vídeo funciona (confirmado em produção,
  `analisadas=3/3`), e o vídeo que falhar **nos dois caminhos** vai para a fila
  como `sem_analise`.

  **O que conferir**, no painel de Moderação:

  | Se… | Então |
  | --- | --- |
  | a fila `Não analisado` seguir vazia | o plano B está dando conta — nada a fazer |
  | aparecer um item de vez em quando | funcionando como projetado; o motivo no item diz qual navegador falhou |
  | encher | o plano B não está cobrindo o caso real, e aí o motivo (que vem com as duas metades) aponta onde |

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

- ⬜ `[29/08]` 🟠 **O feed não mostrou um post recém-publicado, uma vez em sete.**
  *Achado no CI, não reproduzido ainda — está aqui para não sumir em silêncio.*

  Em 29/08 às 22:21 o `fluxos.mjs` falhou no passo 15: publicou e esperou 30 s
  o post aparecer no feed. **Ele nunca apareceu.** Na segunda execução, com o
  mesmo commit, passou.

  **O que eu confirmei no banco** (não é dedução): o post foi criado às
  22:21:02, `deleted_at`, `hidden_at` e `expires_at` todos nulos, a conta sem
  ban nem suspensão. A publicação funcionou inteira — o que falhou foi a tela
  refletir. As seis execuções anteriores do mesmo dia passaram, e o PR daquele
  momento não tocava em nada do caminho de publicação nem do feed.

  **Hipótese, ainda sem prova:** `onPost()` dispara UM refetch depois do
  insert; se aquele refetch não trouxer o post, nada refaz a busca, e o feed
  fica parado até navegar — o que casa com a tela vazia 30 s depois.
  Para confirmar: instrumentar o retorno do refetch (quantas linhas vieram e
  se o id do post recém-criado estava entre elas) e rodar o fluxo umas vezes.

  **Por que não é 🟢:** se a hipótese estiver certa, isto não é problema de
  teste — é uma pessoa publicando, não vendo o próprio post, e concluindo que o
  site comeu o que ela escreveu. O post existe; a tela mente. É §1.5.

- ⬜ `[29/08]` 🟢 **Enfeitar a landing além do que já foi feito.**
  O dono disse em 29/08 que quer a landing "muito mais parruda", mas que por
  agora está bom. Fica anotado para não virar decisão esquecida.

- ⬜ `[01/09]` 🟡 **A idade mínima de 13 anos existe SÓ no navegador.**
  *Achado na auditoria de privacidade de 01/09. O levantamento inteiro está em
  [PRIVACIDADE.md](docs/PRIVACIDADE.md).*

  O `RegisterForm.jsx` limita a data pelo atributo `max` do input. **O banco não
  tem CHECK em `birth_date`** — conferido: existem CHECKs para `platform`,
  `playstyle` e `role`, e nenhum para a data. Com a `anon key`, qualquer um
  chama a REST API e cadastra a data que quiser (§1.3: validação no cliente não
  vale nada sozinha).

  **Por que pesa mais que política de produto:** a LGPD trata dado de criança e
  adolescente em artigo próprio, com consentimento específico.

  **Dimensionado:** 5 perfis, 2 com data, **nenhum** abaixo de 13 e nenhuma data
  absurda. Um CHECK entra sem rejeitar linha existente.

  **Falta a sua decisão:** qual é o piso — 13, 16 ou 18? O número é escolha de
  produto e jurídica, não minha. Com ele eu aplico a migration e travo.

- ⬜ `[01/09]` 🔵 **`login_attempts` e `admin_logs` sem política de retenção.**
  As duas são append-only e guardam dado pessoal — e-mail numa, quem fez o quê
  na outra. Sem prazo, crescem para sempre, e a LGPD fala em necessidade e
  prazo. Já existe infraestrutura de retenção em `lib/logMeta.js`; falta a
  decisão de por quanto tempo guardar.

- ⬜ `[01/09]` 🔵 **Google Fonts entrega o IP do visitante ao Google.**
  Único terceiro que a landing contacta (medido). Hospedar as fontes no próprio
  site elimina isso por alguns KB de banda. **Boa prática, não obrigação
  legal** — a distinção importa.

- ⬜ `[01/09]` 🟡 **Decidir se as 3 luzes dos arcos do raio viram 1 compartilhada.**
  *Auditoria da cena 3D de 01/09. A medição inteira está em
  [DESEMPENHO.md](docs/DESEMPENHO.md); aqui fica só a decisão que falta.*

  A cena tem **7 `pointLight`**, e quatro delas são flashes que ficam apagados a
  maior parte do tempo. No three.js, luz com `intensity = 0` **continua custando
  shader inteiro** — ela segue no array de uniforms e é avaliada por fragmento.

  **O conserto óbvio é armadilha:** alternar `visible` mudaria a contagem de
  luzes, que faz parte da chave do cache de programas — cada troca recompila
  shader. Custo constante viraria engasgo a cada 0,6 s.

  **A proposta viável:** uma `pointLight` compartilhada pelos três arcos (7 → 5).
  **O risco é específico e real:** quando dois arcos disparam dentro da mesma
  janela de 0,36 s, hoje são duas luzes e passariam a ser uma.

  **Por que não implementei:** *"a luz verde não fica tão forte"* já foi uma
  regressão deste projeto, e este ambiente renderiza WebGL por software — não dá
  para medir aqui se o ganho paga o risco. **Precisa de comparação lado a lado
  no aparelho do dono.** Sem isso, alterar seria chute com passos extras.

- ⬜ `[01/09]` 🔵 **UUID de staff exposto ao anônimo em duas tabelas públicas.**
  *Achado na auditoria de gatilhos de 01/09, sondando a REST API como visitante.*

  As duas tabelas que o visitante lê de propósito carregam junto a coluna de
  autoria: `site_config.updated_by` e `blocked_words.created_by`. Qualquer um
  sem conta lê o UUID de quem mexeu na configuração do site e de quem cadastrou
  cada palavra da lista.

  **Por que 🔵 e não mais:** é UUID, não nome. `profiles` responde **401** ao
  anônimo, então não há como mapear UUID → pessoa pela REST API. O impacto real
  hoje é ligar mudanças de config a uma conta, sem saber qual.

  **É CLASSE, não caso:** a pergunta certa não é "essas duas colunas incomodam?"
  e sim *"toda tabela legível pelo anônimo está devolvendo só o que a tela
  precisa?"*. A landing lê `site_config` para o modo manutenção e `blocked_words`
  para o filtro — **nenhuma das duas telas usa a coluna de autoria**.

  **Solução provável:** view ou `select()` explícito sem as colunas de autoria,
  em vez de `select=*`. Antes de revogar coluna, rodar a consulta de "quem lê"
  do [POSTURA.md](docs/regras/POSTURA.md) — revoke já derrubou o site três vezes.

  **Bônus a decidir junto:** a lista inteira de 322 palavras bloqueadas é
  pública. Isso é consequência do filtro rodar no cliente, não descuido — mas
  entrega a quem quiser burlar o dicionário exato. Vale registrar como decisão
  consciente em `DECISOES.md`, ou mudar de abordagem.

- ⬜ `[29/08]` 🟢 **Decidir as outras abas da navegação lateral da landing.**
  Hoje ela tem as cinco seções da página, "Sobre" e "Entrar". Você disse que não
  sabia o que sugerir além do "Sobre" — quando quiser, trago uma proposta do que
  costuma fazer sentido nesta fase (regras da comunidade, contato, novidades) e
  você corta o que não quiser.

- ⬜ `[29/08]` 🟢 **Avaliar um rodapé para o site logado.** A decisão foi
  começar pela landing (camada 1). O site logado tem barra lateral e cabeçalho
  próprios, onde rodapé grande disputa espaço com o conteúdo — pode ser que o
  certo lá seja uma versão bem enxuta, ou nenhum.

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
