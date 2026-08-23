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
  cego para conteúdo sexual. **Não há provedor de reserva** — a documentação
  dizia que o HuggingFace ficava "de reserva", mas em 23/08 a varredura mostrou
  que não sobrou nenhum código que o chamasse: era só a Edge Function `debug-hf`,
  sobra de experimento, que foi neutralizada. Sem `OPENAI_API_KEY` a moderação
  por IA simplesmente não roda (a lista de palavras no banco continua valendo).
  - **Texto:** pisos fixos por categoria (`sexual/minors` 0.10, `sexual` 0.40,
    `harassment/threatening` 0.50…) que o painel **não afrouxa**, mais o dial
    `mod_ai_text_threshold` para o resto.
  - **Imagem:** dois destinos, e esse é o **jogo de cintura do gore**. Nenhum
    modelo distingue gore de Doom de gore real, e a maioria das imagens do site
    é print de jogo — então `violence/graphic` **enfileira e nunca oculta**,
    enquanto `sexual*` e `self-harm*` ocultam. Um limiar errado passa a gerar
    fila maior, nunca censura.
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
- **Painel** (`ModerationPanel`, aba Admin) com sub-abas: **Fila**, **Denúncias**
  (filtráveis por status), **Palavrões** (CRUD) e **Infrações** (histórico
  paginado, filtro por usuário).

Thresholds ficam em `site_config` (`mod_report_threshold`, `mod_ban_threshold`,
`mod_suspend_threshold`), editáveis pela aba **Site** do painel do Owner.


---

[← voltar para o README](../README.md)
