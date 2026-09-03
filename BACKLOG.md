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

**Última conferência contra o sistema:** 02/09/2026, noite ·
**23 itens abertos** (+ 1 ideia sem compromisso)

> **O que a conferência de 02/09 desmentiu** — três linhas daqui estavam
> erradas, e nenhuma delas se corrigiria sozinha:
>
> | O que estava escrito | O que o sistema respondeu |
> | --- | --- |
> | *"`profiles` responde 401 ao anônimo, então não há como mapear UUID → pessoa"* | `select=id,username` responde **200 com as 5 linhas**. A cadeia `site_config.updated_by` → nome fecha. Item subiu de 🔵 para 🟡 |
> | *"UUID de staff exposto em **duas** tabelas"* | `blocked_words.created_by` está **nula nas 322 linhas**. Só `site_config` vaza pessoa |
> | as duas conferências de fila "daqui a alguns dias" | fila com **20 itens, todos resolvidos**, zero pendentes — mas **nada foi postado desde 28/08**, então o zero é falta de amostra, não veredito |
>
> **E um defeito meu, encontrado e corrigido na mesma passada:** o dono aceitou
> a política de privacidade às 19:58 de 02/09, e o PR #140 reescreveu o bloco de
> retenção depois disso **sem subir a versão**. O registro de aceite passou a
> apontar para um texto que ele não leu. Corrigido: versão `2026-09-02-2`, o
> `CHECK` do banco passou a aceitar revisão no mesmo dia, e entrou a trava de
> impressão de conteúdo — ver [PRIVACIDADE.md](docs/PRIVACIDADE.md).

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

  > **Conferido em 02/09, e o número não decide nada ainda:** a fila tem 20
  > itens, **todos resolvidos** (15 `approved`, 5 `rejected`), **zero
  > pendentes** — e nenhum item novo entrou desde 28/08. Fila vazia com uso
  > parado não distingue "o piso está certo" de "ninguém postou". A conferência
  > continua aberta porque ela depende de uso real, não de uma consulta.

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

  > **Conferido em 02/09:** os 20 itens da fila são `post` (13), `chat` (6) e
  > `comment` (1) — **nenhum `sem_analise`**. Mesma ressalva do item acima:
  > nada foi postado desde 28/08, então o zero é falta de amostra, não prova.

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



- ⬜ `[02/09]` 🔵 **Captcha no formulário de contato.** Os limites de vazão
  atuais (3 por e-mail em 24 h, disjuntor de 60/hora) impedem a tabela de virar
  depósito, mas **não** impedem um robô com muitos endereços de encher a hora e
  fechar o canal para todo mundo. Fechar de verdade pediria Turnstile, que
  exige Edge Function e mais uma cota. Quando o alarme `contact_flood` aparecer
  em `admin_logs` alguma vez, é sinal de que a hora chegou.

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

- ⬜ `[01/09]` 🟡 **Staff identificável POR NOME pelo anônimo em `site_config`.**
  *Achado em 01/09 · **severidade corrigida em 02/09**: a justificativa do 🔵
  original era falsa, e a correção veio de refazer a sondagem em vez de confiar
  no que estava escrito (§1.4).*

  **O que dizia aqui, e estava errado:** *"é UUID, não nome; `profiles` responde
  401 ao anônimo, então não há como mapear UUID → pessoa"*. O 401 acontece com
  `select=*` — as colunas sensíveis (`role`, `banned`, `birth_date`, `bio`,
  `avatar_url`) são negadas mesmo. Mas `id` e `username` **passam juntos**:

  ```
  GET /rest/v1/profiles?select=id,username     -> 200, content-range: 0-4/5
  ```

  Então a cadeia inteira fecha, sem conta nenhuma:

  ```
  site_config.updated_by = 7ca78f83-…  ->  profiles?select=id,username
                                       ->  "opedrovini"
  ```

  **10 das 14 linhas** de `site_config` carregam autor, todas o mesmo UUID.
  Qualquer visitante descobre **qual conta administra o site**, pelo nome.

  **Correção de fato, no mesmo item:** `blocked_words.created_by` é lida pelo
  anônimo mas está **nula nas 322 linhas** — a coluna vaza estrutura, não dado.
  Só `site_config` vaza pessoa hoje.

  **O que NÃO é problema (sondado em 02/09):** escrita anônima nas duas tabelas
  devolve **401** em `PATCH` e `POST`, e nada entrou. O privilégio de coluna
  INSERT/UPDATE existe para `anon`, mas a RLS nega — vale fechar por defesa em
  profundidade, não porque esteja aberto.

  **A dependência de `site_config`/`blocked_words` foi checada** (a consulta de
  "quem lê" do [POSTURA.md](docs/regras/POSTURA.md), 02/09): **nenhuma policy**
  usa `updated_by`/`created_by`, e a única função que os toca é
  `owner_set_site_config`, `SECURITY DEFINER`, que não passa por esses
  privilégios. Ali o `REVOKE` das duas colunas é seguro.

  > **`[02/09]` ⚠️ Correção de uma proposta minha que estava ERRADA, e o motivo
  > vale mais do que o item.** Eu propus ao dono revogar também `id`/`username`
  > de `profiles`, dizendo que a dependência estava checada. Estava — só que a
  > consulta de "quem lê" procura **policy e função no banco**, e quem lê essas
  > duas colunas é **o cadastro, no cliente**: `useAuth.jsx` faz
  > `select('id').eq('username', …)` antes do `signUp` para recusar username
  > repetido. O revoke teria quebrado o cadastro do site inteiro — a **quarta**
  > queda por revoke bem-intencionado.
  >
  > E o `docs/SEGURANCA.md` **já dizia isso**, na linha certa, desde sempre:
  > *"`anon` só enxerga `(id, username)` — o suficiente para a checagem de
  > username duplicado"*. Eu li a linha errada do mesmo arquivo.
  >
  > **O que resta, e é menor do que eu disse:** não é o acesso, é a
  > **enumeração**. O cadastro precisa perguntar por **um** username;
  > `select=id,username` devolve **todos**. A saída certa é a que o projeto já
  > usa em `get_public_profile`: uma RPC `username_disponivel(p_username)`
  > `SECURITY DEFINER` devolvendo booleano, e aí o `SELECT` de `anon` em
  > `profiles` pode ser revogado **sem** quebrar nada.

  **O portão que deixava passar, e o que ele passou a fazer.** O
  `portas-do-banco.mjs` sondava só `select=*`, então dava **verde honesto para a
  pergunta errada** — e o `SEGURANCA.md` passou a afirmar, com base nesse verde,
  que "`profiles` responde 401 ao anônimo". Desde 02/09 ele sonda **coluna a
  coluna**: as 8 colunas pessoais precisam continuar em 401, e `id`/`username`
  são registradas como estado conhecido. Ele **não reprova hoje** (item aberto e
  não decidido reprovando todo PR viraria ruído, §0.2), mas reprova a **piora** —
  provado reinjetando o bug: sai 1 nomeando a coluna que abriu.

  **É CLASSE, não caso:** a pergunta certa é *"toda tabela legível pelo anônimo
  devolve só o que a tela precisa?"*. Nenhuma das duas telas usa a autoria.

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


- ⬜ `[02/09]` 🟠 **A cena 3D: o custo é por PIXEL, e a próxima medição é no
  aparelho do dono.** *Primeira medição de regime permanente feita em 02/09 —
  ver [DESEMPENHO.md](docs/DESEMPENHO.md).*

  **O que já se sabe, medido:** o custo da cena escala com **pixels**, não com
  JavaScript. Com 4× menos pixels o bloqueio cai de 5583 ms para **zero** — um
  penhasco, não uma ladeira. E o lado JS é pequeno: a 0,256 Mpx a cena roda
  6 s sem uma única tarefa longa.

  **Por que isso não fecha o assunto:** a medição é num Chromium **sem GPU**,
  onde a CPU faz o trabalho da placa. Num PC de verdade quem paga esse custo é
  a GPU, e eu não meço isso daqui. Usar esse número para julgar o aparelho do
  dono seria artefato de ambiente vendido como fato (§1.1).

  **O que resolve:** abrir o painel de desempenho do navegador **na máquina
  dele**, com a landing aberta, e olhar o tempo de GPU por quadro. Depende dele.

  **Para onde olhar depois disso**, se confirmar: resolução (`dpr` adaptativo,
  que já existe), **overdraw** (camadas transparentes pintadas umas sobre as
  outras) e custo de shader. **Não** é "menos objetos" nem "menos JavaScript" —
  era para lá que eu ia, e a medição desviou.

  **O que NÃO pode:** reduzir qualidade visual para ganhar FPS. O dono já
  recusou aposentar a cena duas vezes — ver [DECISOES.md](docs/DECISOES.md).



- ⬜ `[02/09]` **Responder a mensagem de contato por dentro do painel.** Hoje a
  equipe lê em `/admin` → aba Contato e responde do próprio e-mail, copiando o
  endereço da tela. Responder de dentro exigiria a `send-email`, e portanto a
  cota do Gmail — **a mesma** do cadastro e da recuperação de senha (§0.2).
  Depende do item de migrar o envio de e-mail, logo abaixo. *Não é urgente com
  o volume atual; está aqui para não virar redescoberta.*

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

- ⬜ `[02/09]` 🔵 **Mensagem marcada como SPAM não precisa de 2 anos.**
  *Refinamento do prazo decidido em 02/09, não correção dele.*

  `contact_messages` tem prazo único de 2 anos, e ele foi calibrado pela
  conversa de moderação legítima. Mensagem que a equipe marcou como spam não
  tem essa finalidade — pela LGPD, guardar dado sem finalidade é justamente o
  que o prazo existe para evitar.

  **Por que não fiz junto:** o dono aprovou "2 anos", e inventar uma segunda
  regra que ele não pediu é decidir por ele. Fica registrado; a mudança é uma
  linha no `cleanup_old_data`.


- ⬜ `[02/09]` 🔵 **`date.js` e `roles.js` têm regiões que nenhum teste toca.**
  *Achado pelo teste de mutação — coluna `# no cov`, 65 mutantes.*

  Não é bug: é código sem rede. `roles.js` marca 92,31% no que os testes
  alcançam e 30% no total — ou seja, o que é testado é testado bem, e há uma
  parte que ninguém exercita. Vale olhar quando sobrar fôlego; nenhum dos dois
  é caminho crítico hoje.


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
  fatias (`src/lib/`, <!--n:src.lib.arquivos-->84<!--/n--> arq ·
  <!--n:src.lib.linhas-->6.943<!--/n--> linhas; `src/services/`,
  <!--n:src.services.arquivos-->14<!--/n--> arq ·
  <!--n:src.services.linhas-->1.368<!--/n--> linhas) concentram quase todo o
  benefício — é onde mora
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
