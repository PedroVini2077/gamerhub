# Moderação de conteúdo

> O subsistema mais complexo do projeto, e o que mais mudou. Vale ler inteiro
> antes de mexer em qualquer parte dele — as peças se apoiam umas nas outras, e
> várias decisões aqui existem por causa de um bug específico que já aconteceu.
>
> As decisões e o que foi **descartado** estão em [DECISOES.md](DECISOES.md).

## Moderação de conteúdo

Sistema de moderação com **denúncias da comunidade**, **filtro de palavras** e
**revisão humana**, com ações sempre **reversíveis** (soft-hide, nunca delete
automático). Fluxo: filtro barato síncrono → ocultação automática por denúncias
→ fila de revisão do admin → escalação de infrações.

- **Denunciar** (`ReportModal`): botão ⚑ em posts, comentários e mural (oculto
  para o próprio autor e para visitantes). 6 motivos (spam, ódio, conteúdo
  adulto, assédio, desinformação, outro) + detalhe opcional. Cada usuário só
  denuncia o mesmo conteúdo uma vez (`UNIQUE (reporter_id, content_type,
  content_id)`).
- **Filtro de palavras** (`blocked_words`): ~310 termos em PT e EN, com
  severidade. Existe nos **dois lados**, com a mesma regra de casamento —
  palavra inteira, tolerando plural (`otário` casa `otários`; `es` só a partir
  de 4 letras, para `cu` não casar `cues`). No cliente (`useBlockedWords`,
  cache de 5min) o bloqueio é síncrono e sem custo de API; no banco, o trigger
  `checar_palavras_bloqueadas` é quem vale, porque o site usa a `anon key` e
  qualquer pessoa chama a REST API direto.
  - `high` → conteúdo **nasce oculto** e vai pra fila. No **chat de live** é
    **recusado no envio**: chat não tem `hidden_at` e a mensagem já foi lida
    por quem estava na sala, então esconder depois não repara nada.
  - `medium` → publica normalmente, mas **vai pra fila** do admin.
- **Ocultação automática** (`hidden_at` + trigger `trigger_report_auto_hide`):
  ao atingir `mod_report_threshold` (3) denúncias, o conteúdo é ocultado
  (soft-hide) e entra na fila. As políticas RLS de SELECT escondem conteúdo
  oculto de não-admins; admins+ veem com banner "⚠ Oculto por denúncias".
- **Fila de revisão** (`moderation_queue` + `ModerationQueue`): admin vê preview
  do conteúdo + denúncias, escolhe uma ação (aviso / ocultar / suspender) e
  decide **confirmar a ocultação**, **restaurar** o conteúdo ou **banir** o
  autor direto.
- **Moderação por IA** (`moderate-text` e `moderate-image`, Edge Functions):
  provedor principal **OpenAI `omni-moderation-latest`**, que devolve nota **por
  categoria** — o modelo antigo dava um número só de "toxicidade" e por isso era
  cego para conteúdo sexual.

  **O HuggingFace é reserva só do texto.** `moderate-text` tem um
  `viaHuggingFace()` que entra se a `OPENAI_API_KEY` sumir — e ele volta a ser o
  modelo de um número só, ou seja, volta a ser cego para conteúdo sexual. É rede
  de segurança contra indisponibilidade, não equivalente. A moderação de
  **imagem** não tem reserva nenhuma.

  Cuidado ao mexer nisso: a Edge Function `debug-hf` (neutralizada em 23/08 por
  estar aberta na internet) **não** era essa reserva — era sobra de experimento.
  Apagar a `HUGGINGFACE_API_KEY` junto com ela tira o fallback do texto.
  - **Texto:** pisos fixos por categoria (`sexual/minors` 0.10, `sexual` 0.40,
    `harassment/threatening` 0.50…) que o painel **não afrouxa**, mais o dial
    `mod_ai_text_threshold` para o resto.
  - **Imagem:** dois destinos, e esse é o **jogo de cintura do gore**. Nenhum
    modelo distingue gore de Doom de gore real, e a maioria das imagens do site
    é print de jogo — então `violence/graphic` **enfileira e nunca oculta**,
    enquanto `sexual` e `self-harm*` ocultam. Um limiar errado passa a gerar
    fila maior, nunca censura.

    > A tabela de pisos por categoria, as medições que os produziram, o caso do
    > `sexual/minors` (que **não** vale para imagem) e o caminho de vídeo estão
    > em **[MODERACAO-IA.md](MODERACAO-IA.md)**.
  - O texto **vem do banco**, não do corpo da requisição: aceitar o texto do
    cliente permitiria mandar o `content_id` de um post alheio junto de uma
    frase ofensiva e derrubar o post de outro. Só o autor (ou a equipe) pede a
    moderação de uma linha.
  - A RPC `apply_ai_moderation` só é executável por `service_role` — ela recebe
    o score de quem chama, então liberá-la para `authenticated` daria a
    qualquer pessoa logada o poder de ocultar qualquer coisa mandando score 1.
- **O autor é avisado, e o aviso diz qual regra** (`avisar_autor_do_ocultamento`
  + `motivo_legivel`): *"Seu post foi ocultado automaticamente por assédio a
  outra pessoa."* Só sai quando algo foi **realmente** ocultado — `medium`, que
  publica normal, não gera aviso. Categoria desconhecida cai num texto genérico
  que continua sendo verdade, nunca num palpite.
- **Falha da moderação vira registro** (`registrar_falha_de_moderacao`): as Edge
  Functions são fire-and-forget e o cliente descarta a resposta, então erro de
  RPC ou provedor fora do ar iam para um `console.error` que ninguém lê. Agora
  viram `edge_function_error` em `admin_logs`, severidade `critical`.
- **Infrações e escalação** (`violations` + trigger `trigger_violation_escalation`):
  cada ação confirmada vira pontos (warn 1, hide 2, suspend_1d 5, suspend_7d 10).
  O painel **recusa confirmar sem ação escolhida**, e "Sem punição — só ocultar
  (0 pt)" é uma opção explícita: antes, aprovar sem marcar nada dava zero ponto
  em silêncio e a escalação nunca disparava.
  Ao somar `mod_ban_threshold` (15) pontos, `apply_mod_auto_ban` **bane o usuário
  automaticamente** (com cascade da atividade, log e notificação aos admins).
- **Suspensão temporária** (`profiles.suspended_until` + `apply_suspension`): as
  ações `suspend_1d`/`suspend_7d` **bloqueiam o usuário de criar conteúdo** (post,
  comentário, mural, chat) pelo período, via RLS (os `WITH CHECK` de INSERT
  excluem `banned` **ou** `suspended_until > now()`). O usuário continua
  navegando/lendo — diferente do ban, que tranca o site. A UI mostra um aviso
  (`SuspendedNotice`) no lugar do campo de criação. A coluna é protegida no
  `guard_profile_privileged_cols` (o suspenso não limpa sozinho).
  **Limite de 1 a 30 dias** e **reversão por `lift_suspension`** (mesma
  hierarquia do apply, com log e aviso ao usuário). Sem os dois, um `admin`
  suspendia até o ano 2126 e nem o fundador desfazia — o trigger-guarda revertia
  o `UPDATE` manual em silêncio, virando banimento permanente que pulava toda a
  hierarquia do ban.
- **Conteúdo apagado limpa a fila sozinho** (trigger `AFTER DELETE` nas quatro
  tabelas de conteúdo): sem isso, banir alguém deixava os itens dele `pending`
  apontando para linhas mortas, sem jeito de sair da tela. Fica na tabela e não
  no `ban_user` porque o problema é de **qualquer** caminho que apague conteúdo.
- **O contrato dos tipos de conteúdo é travado por teste**
  (`src/lib/__tests__/tiposDeConteudo.test.js`). Criar conteúdo aqui é um
  **ritual repetido à mão** em quatro lugares — `usePostComposer`, `MuralForm`,
  `useLiveChat`, `CommentSection`:

  ```
  useBlockedWords → checkContent → suspendedUntil → moderateText(TIPO, …)
  ```

  Nada garantia que um 5º tipo lembrasse de todos os passos, nem que existisse
  nos mapas que a fila consulta. **Já quebrou assim:** o `chat` chegou na fila
  sem mapa, caiu num `else → community_posts`, e o card ficou em
  "Carregando..." para sempre.

  O teste confronta três lugares em lados opostos do sistema: o mapa `FONTES`
  da Edge Function `moderate-text`, os três mapas de `queueLabels.js`, e todo
  `moderateText('tipo', …)` do `src/`. **Só é possível porque as Edge Functions
  foram versionadas em 27/08** — antes, o lado do servidor não existia no
  repositório para ser comparado.

  > **Não houve refatoração, e é decisão registrada.** Os quatro pontos não são
  > iguais (post modera texto + imagem + link; mural, texto e imagem; chat e
  > comentário só texto) e o aviso de suspensão mora em camadas diferentes.
  > Forçá-los num molde só custaria mais que o problema. Ver
  > [DECISOES.md](DECISOES.md).

- **Painel** (`ModerationPanel`, aba Admin) com sub-abas: **Fila**, **Denúncias**
  (filtráveis por status), **Palavrões** (CRUD) e **Infrações** (histórico
  paginado, filtro por usuário).

Thresholds ficam em `site_config` (`mod_report_threshold`, `mod_ban_threshold`,
`mod_suspend_threshold`), editáveis pela aba **Site** do painel do Owner.


---

[← voltar para o README](../README.md)

## `[28/08]` Moderação por IA de mídia — mudou de arquivo

A política por categoria (o que **oculta** × o que só **enfileira**), os
limiares, as medições que os produziram e o caminho de vídeo por amostragem de
quadros agora vivem em **[MODERACAO-IA.md](MODERACAO-IA.md)**.

Saíram daqui em 28/08 porque passaram de 150 linhas — `CLAUDE.md` §6.2. O que
ficou neste arquivo é o resto do subsistema: a fila, a denúncia, a wordlist, o
banimento e o recurso.

## `[28/08]` Quem é banido passa a ter como recorrer

**O que existia:** a `BannedScreen` mostrava o motivo e deslogava em 6 segundos
— sem botão, sem formulário, sem contato. E `request_unban` exigia cargo de
staff, ou seja, **só um admin abria o pedido em nome da pessoa**.

Era coerente com a hierarquia e, ainda assim, uma porta que só abre de um lado:
quem foi banido por engano — e engano acontece, ainda mais com moderação
automática — não tinha a quem recorrer nem sabia a quem.

**O formulário.** `solicitar_revisao_do_proprio_ban` é chamável pela própria
pessoa banida, com as regras **no banco** (o site entrega a `anon key`, então
validação só no cliente não vale nada):

| Regra | Valor |
| --- | --- |
| Pedidos por banimento | **1** |
| Tamanho do texto | 20 a 1000 caracteres |
| Quem pode chamar | `authenticated` e de fato banido; `anon` não |

**O corte de "um por banimento" é `profiles.banned_at`**, e não "existe pedido
pendente". A diferença importa: contar pendentes deixaria a pessoa insistir para
sempre depois de uma negativa; contar desde o ban atual dá direito a recorrer de
novo se ela for desbanida e banida outra vez.

**A contagem regressiva parou de ser armadilha.** Ela subiu para 20 s e agora
**pausa enquanto o formulário está aberto** — cronômetro correndo por cima de um
formulário seria pior que não ter formulário.

**`[28/08]` A tela sobe no PRÓPRIO login, e a sessão fica viva até a pessoa
terminar.** Antes o `signInWithEmail` deslogava na hora e o `Login.jsx` mostrava
um toast genérico — o formulário de recurso nunca aparecia no login, e entre o
`signInWithPassword` e o `signOut` a pessoa via o site por alguns segundos.

Manter a sessão é o que **torna o recurso possível**:
`solicitar_revisao_do_proprio_ban` exige `authenticated`. Sem sessão não haveria
como pedir revisão nenhuma. O `signOut` acontece quando ela termina — pelo
botão, ou pelo contador.

> **Segurança:** banido com sessão não cria nada. As policies de INSERT checam
> `banned` no banco, então o bloqueio nunca dependeu desta tela.

**`[28/08]` A tela SUBSTITUI o site, não fica por cima dele.** Manter a sessão
viva tinha um efeito que só apareceu no teste do dono: *"a pessoa chega a logar
no site, só fica o popup por cima"*. Ele estava certo, e o mecanismo era este —
com sessão, `GuestOnly` tirava a pessoa do `/login`, `HomeOrLanding` via `user`
e **montava o feed inteiro atrás do overlay**. Um `Escape`, um zoom ou o
DevTools bastariam para ler o site; e o app ficava rodando por trás, assinando
realtime e buscando post.

O conserto é uma linha no `AuthProvider`: a `BannedScreen` passou de irmã de
`{children}` a **alternativa** a `{children}`. A sessão continua existindo — é
o que o formulário de recurso precisa — mas o site nunca chega a montar.

> Efeito colateral que virou melhoria: o `Toaster` é filho do provider e some
> junto. O erro do formulário passou a aparecer **dentro da própria tela**, que
> é onde ele deveria estar desde o começo.

**E ao sair, o destino é a landing** — antes era `/login`. A landing é a porta
de entrada e a única página que não depende do banco; jogar quem acabou de ser
recusado direto no formulário de login sugere tentar de novo o que não vai dar.

**E ela acompanha o caso.** `meu_pedido_de_revisao()` devolve o pedido do
banimento atual, e a tela mostra *Em análise* / *Aprovado* / *Negado* com a
resposta da equipe. **Notificação em tempo real não resolveria** — se o admin
decidir enquanto a pessoa não está online, o aviso passa batido. Estado
consultável no banco não expira nem depende de alguém estar com o site aberto
na hora certa.

### `[28/08]` Ser desbanido também avisa

O contrário faltava, e o dono achou: quando o ban é removido, a `BannedScreen`
simplesmente **para de aparecer**. Do lado de quem foi desbanido, "meu recurso
foi aceito" e "o site parou de me bloquear por algum bug" eram a mesma coisa —
nenhum aviso, nenhuma explicação.

`unban_user` e `approve_unban_request` passaram a gravar uma linha em
`notifications` (`type = 'unban'`), que o sino do `Header` já lê. **Os dois
caminhos**, e não só um: o super admin desbanindo direto e o pedido de revisão
sendo aceito chegam ao mesmo estado por portas diferentes — corrigir uma só
seria o erro clássico de tratar o caso em vez da classe (`CLAUDE.md` §5).

Por que `notifications` e não email ou realtime: pelo mesmo motivo do parágrafo
acima. A decisão pode sair enquanto a pessoa não está online; estado guardado
no banco espera ela voltar.

> O mapa de ícones do sino era dois ternários com um `else` que engolia tudo —
> `comment` já caía nele havia meses. Virou `lib/notifMeta.js`, com um teste que
> confronta as chaves do mapa contra todo `INSERT INTO notifications` das
> migrations.

### Bug de hierarquia corrigido junto

`request_unban` checava `v_caller_role NOT IN ('admin')` — lista literal com
**um** cargo. Efeito: `super_admin` e `owner`, que estão acima de admin, **não
conseguiam abrir pedido de desbanimento**. O fundador era barrado de uma ação
que o subordinado dele fazia.

É a quarta vez que uma lista de papéis escrita à mão morde este projeto
(`CLAUDE.md` §1.3, *"hierarquia nunca se escreve à mão"*). Passou a usar
`is_staff()`.

## `[28/08]` Denúncia entra na trilha

A decisão original era **não** logar: qualquer pessoa denuncia, e o receio era
inflar `admin_logs` com ruído. O dono reavaliou e pediu o log — e o receio se
inverteu no caminho.

**Denúncia era a única ação de moderação sem rastro.** Ocultar, suspender,
banir, aprovar na fila — tudo registra. A denúncia, que é o gatilho de boa parte
disso, sumia: quando um conteúdo aparecia na fila, a trilha não sabia dizer se
veio da IA, da wordlist ou de alguém denunciando.

**É trigger, não chamada do frontend** (`log_report_created` em `reports`). O
site entrega a `anon key`, então qualquer um insere em `reports` direto pela
REST API — log que depende do cliente chamar é log que o cliente escolhe não
gerar.

**Sobre o volume:** `admin_logs` já tem retenção agendada (`cleanup_old_data`,
90 dias). Se um dia virar ruído de fato, o caminho é o mesmo do
`registrar_falha_de_edge_function` — uma linha por hora por tipo — e não voltar
ao silêncio.
