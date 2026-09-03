# Arquitetura

> Como o código está organizado: pastas, rotas, camada de dados e as convenções
> que valem em todo lugar. Para *o que* cada tela faz, ver
> [FUNCIONALIDADES.md](FUNCIONALIDADES.md). Para tabelas e RPCs, ver
> [BANCO.md](BANCO.md).

## 📁 Estrutura de pastas

```
src/
├── App.jsx                # Rotas, layout, HomeOrLanding, modo manutenção, feature gates
├── paginasLazy.js         # As páginas sob demanda, só declaração. Saíram do
│                          # App.jsx quando ele passou de 300 linhas (§4)
├── main.jsx               # Bootstrap React
├── index.css              # Tema (cores neon, classes .card/.btn/.tag/.input)
├── assets/
│   └── landing/           # Prints reais do site usados na landing (feed, mural, lives,
│                          # ranks, keys) — nomes de usuários censados por privacidade
├── hooks/
│   ├── useAuth.jsx        # Sessão, perfil e ações de autenticação. É a raiz da
│   │                      # árvore e o arquivo de maior risco do projeto (§7)
│   ├── useVigiaDeBanimento.js # Realtime + poll de 60 s que detectam ban durante
│   │                      # o uso. Saiu do useAuth em 29/08 — testável isolado
│   ├── usePresenca.js     # Canal de presence: quantos estão online agora
│   ├── useRole.js         # Deriva flags isOwner/isAdmin/isSuperAdmin/isBanned
│   ├── useRealtime.js     # Helper genérico de subscription Postgres changes
│   ├── useCommentLike.js  # Estado de like de comentário
│   ├── useBlockedWords.js # Cache da wordlist + checkContent() (filtro de moderação)
│   ├── useAdminData.js    # Dados do painel admin, paginados em blocos (posts e
│   │                      # keys crescem sem limite com o uso)
│   ├── useAdminRealtime.js# Realtime do painel, em DOIS canais por tempo de vida
│   ├── useAdminLogs.js    # Estado e busca dos logs de auditoria
│   ├── useAdminNotifications.js # Quais notificações de staff este usuário vê
│   ├── useAdminContentActions.js # Ações destrutivas sobre post e key, atrás de ConfirmModal
│   ├── useAdminLiveActions.js    # Ações sobre live. Trata 0 linhas como falha —
│   │                      # a RLS nega devolvendo zero linhas e NENHUM erro
│   ├── useAdminStaffActions.js   # Promover, rebaixar, banir, suspender
│   ├── useOwnerUserActions.js    # As mesmas ações, no painel do fundador
│   ├── useCargoDecisions.js      # Decisões de indicação/estágio/rebaixamento
│   ├── useUnbanRequests.js       # Pedidos de desbanimento pendentes
│   ├── useMensagensDeContato.js  # Estado da aba "Contato" do painel admin
│   ├── useAceitesPendentes.js    # Quais documentos faltam ser aceitos. Guarda
│   │                      # de QUEM são os dados: resposta que chega depois de
│   │                      # a sessão trocar é reconhecível como velha
│   ├── useBlockedLogins.js       # Logins travados por excesso de tentativa
│   ├── usePostComposer.js # Publicar: upload, moderação e limpeza do formulário
│   ├── usePostEngagement.js # Curtidas e comentários de um post
│   ├── useLiveChat.js     # Chat da live
│   ├── useLiveModeration.js # Silenciar e remover no chat da live
│   ├── useLivesList.js    # Lista de lives, com debounce (INSERT e UPDATE quase juntos)
│   ├── useProfileForm.js  # Estado do formulário de perfil
│   ├── useProfileStats.js # Números do perfil
│   ├── useUserXP.js       # XP e rank do usuário
│   ├── useAvatarUpload.js # Envio da foto de perfil
│   ├── useDeleteCountdown.js # Contagem antes de ação destrutiva, com cancelar
│   ├── useConfigDoSite.jsx # `[03/09]` A config global (manutenção + motivo da
│   │                      # pausa), lida UMA vez no topo da árvore. Vivia
│   │                      # dentro do `Layout`, que nunca monta na landing —
│   │                      # por isso quem chegava por ela via a mensagem
│   │                      # genérica mesmo com o banco de pé. É contexto, e
│   │                      # não hook solto: duas chamadas criavam o MESMO
│   │                      # canal de realtime e derrubavam o site
│   ├── useDbOffline.js    # `true` enquanto o site está sem banco (ver lib/dbHealth)
│   └── useVisiblePoll.js  # Repete uma chamada, mas SÓ com a aba visível
├── lib/
│   ├── supabase.js        # Cliente Supabase
│   ├── queryClient.js     # React Query client (staleTime 30s, retry 1)
│   ├── image.js           # Compressão/resize client-side antes do upload (economia de egress)
│   ├── storage.js         # Remoção de arquivos do bucket ao deletar post/mural
│   ├── auditLog.js        # logAudit() -> RPC log_audit_event
│   ├── url.js             # safeExternalUrl() — só http(s) vira href (anti-XSS)
│   ├── logMeta.js         # Fonte única de categorias/ícones/retenção dos logs
│   ├── like.js            # Curtida otimista com rollback quando o servidor recusa
│   ├── ranks.js           # Tiers de XP, cálculo de rank, fontes de XP
│   ├── embed.js           # getEmbedInfo() — parsing de URLs YouTube/Twitch/TikTok/Instagram
│   ├── format.js          # Formatação de números (1K, 1M...)
│   ├── somAmbiente.js     # Som ambiente da landing: ciclo de vida do áudio,
│   │                      # volume, fade e a garantia de UMA instância só.
│   │                      # Não sabe QUE som toca — isso são os dois abaixo
│   ├── trilhaAmbiente.js  # O arquivo real. `[03/09]` Trocado a pedido do dono
│   │                      # para "Lofi Coffee Shop" (Alex Morgan, Pixabay
│   │                      # Content License). Baixa sob demanda, decodifica e
│   │                      # toca em laço. O original NÃO era loop: tinha
│   │                      # fade-out no fim, e a região foi recortada e
│   │                      # costurada com crossfade — o ponto de corte saiu de
│   │                      # medir 5 candidatos, não de escolher a olho
│   ├── vozesSintetizadas.js # O plano B, quando o arquivo não chega (rede
│   │                      # fora, codec ausente). Silêncio aqui daria um
│   │                      # botão "ligado" sem som — a tela mentindo
│   ├── ritmoDoRaio.js     # TRAVA: tempo por delta, porque o R3F ZERA o relógio
│   │                      # da cena a cada mudança de frameloop
│   ├── rotasComSom.js     # Onde o som ambiente toca. Lista FECHADA: rota
│   │                      # desconhecida é silêncio, não música — a regra
│   │                      # invertida faria toda página nova nascer tocando
│   ├── acentoDaSecao.js   # Como cada seção do site logado se veste: a COR do
│   │                      # fundo e o ELENCO de peças. Sem padrão de propósito:
│   │                      # tela nova sem entrada aparece sem fundo e sem peças
│   ├── documentosLegais.js # Os três documentos que a pessoa aceita, e a
│   │                      # VERSÃO de cada um. Sem versão, mudar a política
│   │                      # apagaria o sentido de todo aceite anterior
│   ├── preferenciaDeSom.js # A decisão sobre o som ambiente, com TRÊS estados
│   │                      # (ligado / desligado / nunca escolheu). Apagar a
│   │                      # chave ao desligar tornava "desliguei" igual a
│   │                      # "nunca escolhi" — e o autoplay religaria o som
│   ├── introJaVista.js    # Lembra, por sessão do navegador, que a intro do
│   │                      # raio já foi vista — e decide se ela toca
│   ├── roles.js           # Hierarquia de cargos no cliente; espelha `role_rank()`
│   │                      # do banco. TRAVA: lista literal de cargo é bug (§1.3)
│   ├── roleLabels.js      # Fonte única do nome e da cor de cada cargo na UI
│   ├── realtimeTables.js  # TRAVA: assinatura de realtime só vale para tabela que
│   │                      # está na publicação `supabase_realtime`
│   ├── tabelasSemUpdate.js # TRAVA: as tabelas SEM policy de UPDATE no banco.
│   │                      # `update` nelas devolve 0 linhas e NENHUM erro — a
│   │                      # tela diz que salvou e nada acontece
│   ├── etapasDoCaso.js    # As etapas da linha do tempo de quem foi banido.
│   │                      # TRAVA: o mapa de desfechos tem que cobrir os
│   │                      # status que `unban_requests` aceita — a tela testava
│   │                      # `rejected` e o banco grava `denied`
│   ├── recarregarAteAparecer.js # Recarrega a lista até o item recém-criado
│   │                      # aparecer. Leitura logo após escrita pode cair numa
│   │                      # conexão do pool que ainda não vê a linha — o feed
│   │                      # engolia o post e nada estourava (§1.5)
│   ├── notifMeta.js       # Ícone e cor de cada tipo de notificação do sino
│   ├── loginBlock.js      # Fonte única do estado de bloqueio de login
│   ├── dbHealth.js        # Detecta banco fora do ar e leva o site para a landing
│   ├── pauseReason.js     # Motivo da pausa, guardado no navegador
│   ├── ehFalhaDeRede.js   # `[03/09]` Este erro é queda de REDE ou defeito do
│   │                      # site? O `ErrorBoundary` chamava Wi-Fi caindo de
│   │                      # "algo deu errado", e a mensagem falsa mandava
│   │                      # procurar bug onde não havia. Trava os DOIS lados:
│   │                      # confundir bug com rede o esconderia do Sentry
│   ├── objectUrls.js      # Controle de blob URLs — sem revoke, o arquivo fica na RAM
│   ├── monitoring.js      # Sentry sob demanda
│   ├── capturaAntecipada.js # Rede de captura que existe ANTES de o Sentry chegar
│   ├── tetoDeEventos.js   # Teto de eventos por sessão: uma rajada vira 1 evento,
│   │                      # não mil — é o que protege a cota do Sentry (§0.2)
│   ├── password.js        # Força de senha (compartilhado Login/AuthConfirm)
│   ├── date.js            # Cálculo de idade / idade mínima de cadastro
│   ├── csv.js             # Geração + download de CSV (export de logs)
│   ├── wordlist.js        # Match de palavra inteira do filtro de moderação
│   ├── framesDeVideo.js   # Extrai 3 quadros de um vídeo no navegador, para a
│   │                      # moderação de imagem analisar (ver MODERACAO-IA.md).
│   │                      # Aceita o arquivo local OU a URL já publicada — o
│   │                      # plano B de quando o navegador recusa o `blob:`
│   ├── quadroDesenhado.js # `nadaFoiDesenhado`: quadro transparente prova que o
│   │                      # `drawImage` não teve o que desenhar
│   ├── erroDeMidia.js     # Traduz os 4 `MediaError` — cada um aponta para um
│   │                      # lugar diferente, e uma frase só mentia sobre três
│   ├── paginacaoDePosts.js# Faixa da página por sub-aba no painel de posts
│   │                      # (fora do React porque a metade que importa — a
│   │                      # cena SOBE de resolução — não dá para provar num
│   │                      # navegador sem GPU)
│   ├── motion.js          # Variantes Framer Motion compartilhadas (fade, grid, list)
│   └── landingMotion.js   # Variantes de animação exclusivas da landing (hero, reveal, stagger)
├── services/              # Camada de acesso a dados (Supabase) por domínio
│   ├── result.js          # Contrato ÚNICO de retorno da camada de services —
│   │                      # existir isto é o que impede cada service inventar
│   │                      # a sua convenção (um chegou a lançar exceção)
│   ├── banService.js      # Ban, desban e o pedido de revisão aberto pela
│   │                      # PRÓPRIA pessoa banida
│   ├── contatoService.js  # O canal público `/contato`: envio pela RPC (única
│   │                      # porta de entrada da tabela) e a leitura da equipe
│   ├── aceiteService.js   # Grava a PROVA do aceite dos documentos: quem, qual
│   │                      # documento, qual versão, quando. A caixinha do
│   │                      # formulário não prova nada sozinha
│   ├── cadastroService.js # Criar conta, do zero até a prova do aceite. Saiu do
│   │                      # `useAuth.jsx` em 03/09: aquele é o arquivo de maior
│   │                      # risco do projeto e cuida de SESSÃO — cadastro
│   │                      # acontece ANTES de existir sessão, e foi por isso que
│   │                      # dois bugs se esconderam lá dentro (o UPDATE que
│   │                      # rodava como `anon` e afetava 0 linhas em silêncio,
│   │                      # e o `select` que mantinha `profiles` aberto)
│   ├── roleNominationService.js # Indicação, estágio e rebaixamento de cargo
│   ├── postService.js     # Posts, likes, mídia, comentários, lives ativas
│   ├── profileService.js  # Perfis, XP, stats, avatar, preferências
│   ├── communityService.js# Mural da comunidade
│   ├── liveService.js     # Chat de live, silenciamentos
│   ├── keyService.js      # Keys/promos, stats do site
│   ├── authService.js     # Trocar senha/email, deletar conta
│   ├── commentService.js  # Comentários e curtidas de comentário (saiu do
│   │                      # postService em 29/08, quando ele passou de 300)
│   ├── moderationService.js # Denúncias, fila, wordlist, infrações, hide/restore
│   └── moderationAiService.js # As chamadas de IA (Edge Functions), separadas
│                            # do resto em 29/08: o de cima fala com TABELAS e
│                            # devolve `{data,error}` para a tela; este fala com
│                            # EDGE FUNCTIONS por `fetch`, é fire-and-forget, e
│                            # tem que gritar sozinho (§1.5)
├── pages/
│   ├── Landing.jsx        # Página pública para visitantes não logados
│   ├── Home.jsx           # Feed principal
│   ├── Login.jsx          # Login / cadastro / recuperação de senha
│   ├── AuthConfirm.jsx    # Confirmação de e-mail / reset de senha (magic link)
│   ├── PostPage.jsx       # Um post sozinho, em `/post/:id`. Existe para o link
│   │                      # direto da fila de moderação; mostra conteúdo oculto
│   │                      # para quem é da equipe (a RLS decide)
│   ├── Sobre.jsx          # `/sobre` — pública, para ler antes de criar conta
│   ├── Termos.jsx         # `/termos` — o terceiro documento, e o único que
│   │                      # fala de CONTRATO: de quem é o conteúdo, quando a
│   │                      # conta é encerrada, que garantia não existe
│   ├── Contato.jsx        # `/contato` — falar com a administração de FORA do
│   │                      # site. Pública porque quem está banido, quem perdeu
│   │                      # o acesso e quem nem tem conta são exatamente as
│   │                      # pessoas que mais precisam dela
│   ├── MuralPage.jsx      # Uma mensagem do mural, em `/mural/:id`
│   ├── Community.jsx      # Mural da comunidade
│   ├── Keys.jsx           # Keys grátis & promoções
│   ├── Lives.jsx          # Lista de lives + sub-tabs + player + chat + moderação
│   ├── Ranks.jsx          # Explicação do sistema de XP/ranks
│   ├── Profile.jsx        # Perfil próprio (edição, avatar, stats, XP)
│   ├── UserProfile.jsx    # Perfil público de outro usuário
│   ├── Settings.jsx       # Conta: senha, e-mail, notificações, deletar conta
│   ├── Admin.jsx          # Painel admin / super admin (multi-aba)
│   ├── Owner.jsx          # Painel do fundador (multi-aba)
│   └── NotFound.jsx       # 404
└── components/
    ├── ErrorBoundary.jsx
    ├── layout/            # Sidebar, Header
    │   ├── FundoDaSecao.jsx # O fundo do site logado, em DUAS camadas com
    │   │                  # papéis separados: `LuzesDaArena` é atmosfera (quase
    │   │                  # parada) e `PecasFlutuantes` é o movimento. Duas
    │   │                  # camadas se mexendo disputariam atenção com o texto
    │   ├── LuzesDaArena.jsx # `[03/09]` A camada de baixo, e ela NÃO é a da
    │   │                  # landing: o dono corrigiu que o site logado tem que
    │   │                  # ser diferente. Duas luzes que respiram em ciclos
    │   │                  # primos entre si (37 s e 53 s, nunca coincidem) e
    │   │                  # cinco mini explosões em anel, nas cores da MARCA e
    │   │                  # não da seção — se herdassem o acento da aba,
    │   │                  # sumiriam dentro da própria cor
    │   ├── PecasFlutuantes.jsx # As peças que atravessam a tela. Só CSS no
    │   │                  # compositor — zero bloqueio medido a CPU 1/4
    │   └── pecasDeJogo.jsx # Os SVG: controle, d-pad, moeda, vida, troféu,
    │                      # nave, raio, balão, chave, fliperama. Desenhados
    │                      # aqui e não emoji de teclado, que muda por sistema
    ├── auth/              # LoginForm, RegisterForm, RegisterSuccess, ForgotForm, InputWrap
    │   └── AceiteDosDocumentos.jsx # UMA caixinha cobrindo os três documentos,
    │                      # com links em aba nova. Três caixinhas separadas
    │                      # treinam a pessoa a clicar sem ler
    ├── feed/              # PostCard, PostForm, CommentSection, CommentCard
    ├── community/         # MuralCard, MuralForm
    ├── keys/              # KeyEditor
    ├── lives/             # LivesList, ChatPanel, ModPanel, LiveGoModal
    ├── admin/             # UsersPanel, PostsPanel, LivesPanel, KeysPanel,
    │                      # NotifsPanel, LogsPanel, SuperAdminPanel, StatCard,
    │                      # AdminTabs, AdminTabContent, AdminModals
    │   ├── ContatoPanel.jsx # As mensagens do formulário público. É o outro
    │   │                  # lado do canal: sem ele a mensagem cairia numa
    │   │                  # tabela que ninguém abre (§1.5)
    │   ├── UnlockLoginModal.jsx / UnlockCountdownBtn.jsx # Desbloqueio de login,
    │   │                  # com espera forçada de 10 s — o tom é pesado de propósito
    │   ├── UnbanRequestModal.jsx / ReactivationModal.jsx # Análise de pedidos
    │   └── cargos/        # CargosTab e as peças dela: CargoSection, NominationCard,
    │                      # TrialCard, DemotionCard, CandidateHeader,
    │                      # EligibilityChecklist, DecisionButton
    ├── owner/             # PainelTab, UsuariosTab, LogsTab, SiteTab,
    │                      # NotificacoesTab, MetricasTab, SiteModerationCards
    │   └── usuarios/      # UserRow, UserFilters, RoleOverride (o cargo de
    │                      # fundador NÃO se atribui por override)
    ├── moderation/        # ModerationPanel, ModerationQueue, ReportsList,
    │                      # WordlistManager, ViolationsPanel, QueueItemCard,
    │                      # QueueContentPreview, QueueMidia (a prévia de imagem
    │                      # e vídeo dentro da fila)
    │   └── queueLabels.js # TRAVA: todo tipo da fila precisa existir nos três
    │                      # mapas — foi um tipo novo sem entrada que travou a tela
    ├── landing/           # Hero, ElectricTitle, IntroLightning, FeatureSection,
    │                      # HighlightsStrip, FinalCTA, LandingNav, LandingFooter,
    │                      # LandingShot, Scene2D, Scene3D, BotaoCena3D
    │   ├── FluxoDeDados.jsx # Traços de dados subindo atrás da landing.
    │   │                  # Parallax por variável CSS + UM ouvinte de ponteiro,
    │   │                  # agrupado em 3 planos por custo medido
    │   ├── BotaoDeSom.jsx # Liga/desliga o som ambiente. Desligado por padrão:
    │   │                  # navegador bloqueia autoplay, e site que toca
    │   │                  # sozinho faz fechar a aba
    │   ├── secoesDaLanding.js # Fonte única das seções: faixa, rodapé e gaveta
    │   ├── dimensoesDosPrints.js # Tamanho real de cada print, em pixels
    │   ├── LandingSidebar.jsx # Navegação lateral (gaveta) da landing
    │   └── scene3d/       # LandingScene (createRoot + extend seletivo), Lightning,
    │                      # SceneObjects (LogoBolt/FloatingShapes)
    ├── auth/              # LoginForm, RegisterForm, RegisterSuccess, ForgotForm,
    │                      # InputWrap, e os dois porteiros de rota:
    │                      # RequireAuth (barra visitante) e GuestOnly (barra logado)
    ├── layout/            # Header e RightPanel do site logado
    ├── feed/              # PostCard, PostForm, CommentSection, CommentCard,
    │                      # CommentComposer, EditCountdown (janela de edição)
    │   └── composer/      # ComposerToolbar, MediaPreviewGrid, AudioAttachment,
    │                      # EmbedComposer
    ├── community/         # MuralCard, MuralForm
    ├── lives/             # LivesList, ChatPanel, ModPanel, LiveGoModal
    ├── keys/              # KeyEditor
    ├── profile/           # ProfileIdentityCard, PersonalInfoCard, GamingCard,
    │                      # SocialLinksCard, PlayerStatsCard, AvatarModal,
    │                      # AdminApplicationCard
    ├── conteudo/          # A casca das páginas públicas de texto
    │   ├── PaginaDeConteudo.jsx # Extraída quando a SEGUNDA ia nascer: cópia
    │   │                  # diverge (§4). Hoje serve /privacidade, /regras,
    │   │                  # /termos e /contato
    │   └── FundoAnimado.jsx # As peças que atravessam a tela atrás do texto.
    │                      # Mora na CASCA, não em cada página: assim toda aba
    │                      # nova ganha por construção, e ninguém precisa
    │                      # lembrar de acrescentar uma linha
    ├── regras/            # As regras da comunidade (`/regras`), públicas
    │   └── conteudoDasRegras.js # O texto, tirado do que a moderação REALMENTE
    │                      # faz — se uma regra está lá, há mecanismo por trás
    ├── termos/            # Os Termos de Uso (`/termos`), públicos
    │   └── conteudoDosTermos.js # O texto, escrito a partir do que o sistema
    │                      # faz — termo que promete o que o site não faz é
    │                      # pior do que termo nenhum
    ├── contato/           # O canal público para falar com a administração
    │   ├── assuntosDeContato.js # Mapa EXPLÍCITO dos assuntos. A lista existe
    │   │                  # também no CHECK do banco, e um teste compara as
    │   │                  # duas contra o SQL aplicado em db/
    │   └── FormularioDeContato.jsx # O formulário. Não consulta NADA antes de
    │                      # enviar — responder diferente conforme o e-mail
    │                      # informado seria oráculo de enumeração
    ├── privacidade/       # A política de privacidade (`/privacidade`), pública
    │   └── conteudoDaPrivacidade.js # O texto, escrito a partir do
    │                      # levantamento medido em docs/PRIVACIDADE.md. Bloco
    │                      # `pendente` = decisão do dono, marcada na tela
    ├── sobre/             # A página do projeto (`/sobre`), pública
    │   ├── conteudoDoSobre.js # Os sete blocos de texto — a FONTE, escrita pelo
    │   │                  # dono. A página só renderiza esta lista
    │   ├── iconesDoSobre.js   # Mapa explícito nome -> ícone do lucide. Sem
    │   │                  # padrão de propósito: bloco sem ícone estoura no teste
    │   ├── CreditosDeMidia.jsx # Atribuição TASL da mídia de terceiro. NÃO é
    │   │                  # cortesia: CC-BY exige crédito visível, e um teste
    │   │                  # varre src/assets/som/ exigindo crédito por arquivo
    └── ui/                # Avatar, AvatarPopup, BanModal, BannedScreen,
                           # ConfirmModal, ReasonModal, ReportModal, SuspendedNotice,
                           # EmbedPlayer, MediaCarousel, MediaLightbox, MediaPlayer,
                           # AudioRecorder, GlobalBanner, FeatureGate,
                           # LinhaDoTempoDoCaso (o andamento do recurso, na
                           # tela de quem foi banido),
                           # AvisoDeAceite (documento novo para aceitar — avisa
                           # e NÃO bloqueia; some por sessão, não para sempre),
                           # LazyVisible, PageTransition, RolagemDeRota (decide
                           # para onde a página rola ao trocar de rota),
                           # AvisoSemBanco (faixa
                           # de banco fora do ar — não sequestra o app),
                           # MaintenancePage (`[03/09]` a tela de pausa, e ela
                           # mostra o MOTIVO que o dono escreveu no painel —
                           # antes o texto era cravado e o `pause_reason`
                           # morria sem aparecer; saiu do App.jsx quando ele
                           # passou de 300 linhas),
                           # SplashScreen (só durante
                           # a resolução inicial da sessão)
```

**Fora de `src/`** — atualizado em 28/08, porque esta nota só citava `db/`:

| Pasta | O que guarda |
| --- | --- |
| `supabase/migrations/` | **A verdade sobre o schema.** As migrations que recriam o banco do zero |
| `supabase/functions/` | Espelho das Edge Functions em produção. Editar aqui e implantar, nunca o contrário — os testes de contrato leem daqui |
| `scripts/` | Portões do CI (orçamento de bytes, documentação quebrada, **mapa de arquivos**, **segredos vazados**, ignorar deploy da Vercel), o relatório de documentação envelhecida, e os dois que rodam FORA do CI: `inicio-de-sessao.sh` (gatilho do `SessionStart`) e `fim-de-sessao.mjs` (`npm run fim`) |
| `stryker.config.json` | Configuração do teste de mutação (`npm run mutacao`). Escopo deliberadamente pequeno: só a lógica pura de `src/lib/` |
| `e2e/` | Testes em navegador de verdade: rotas, fluxos autenticados, painel de admin, portas das Edge Functions, **portas do banco** (`portas-do-banco.mjs`, o único que fala com o Postgres), o laço da cena 3D, e **conteúdo visível** (`conteudo-visivel.mjs`, que rola as páginas públicas num tamanho de celular e reprova o que ficar em `opacity: 0`) |
| `.claude/` | `settings.json` com o hook `SessionStart` — o gatilho que injeta o estado real do projeto no começo de toda sessão |
| `docs/regras/` | As seções grandes do `CLAUDE.md`, puxadas por `@import` — valem como se estivessem lá dentro |
| `db/` | Scripts SQL avulsos para o SQL Editor e os relatórios de auditoria (`AAAA-MM-DD-*.md`). Não são migrations |

### Rotas

| Rota                | Página       | Proteção                                         |
| ------------------- | ------------ | ------------------------------------------------ |
| `/`                 | Landing      | pública (visitantes) — ou Home se logado         |
| `/login`            | Login        | pública                                          |
| `/auth/confirm`     | AuthConfirm  | pública (magic link)                             |
| `/community`        | Community    | `FeatureGate: feature_community`                 |
| `/keys`             | Keys         | `FeatureGate: feature_keys`                      |
| `/lives`, `/lives/:id` | Lives     | `FeatureGate: feature_lives`                     |
| `/ranks`            | Ranks        | pública                                          |
| `/profile`          | Profile      | requer login                                     |
| `/u/:username`      | UserProfile  | pública                                          |
| `/settings`         | Settings     | requer login                                     |
| `/admin`            | Admin        | redireciona não-admins                           |
| `/owner`            | Owner        | redireciona não-owner                            |
| `*`                 | NotFound     | —                                                |

A rota raiz `/` usa o componente `HomeOrLanding` que decide entre `Landing` e
`Home` com base no estado de autenticação — visitantes veem a landing page,
usuários logados veem o feed diretamente.

Páginas pesadas são **lazy-loaded** (code-splitting). Há **transição de página
global** (Framer Motion) e **modo manutenção** que bloqueia o site para todos
exceto o owner, reagindo em tempo real à `site_config`.

---

## ⚡ O caminho crítico de carregamento

> Levantado por um Lighthouse em produção em 27/08/2026 e corrigido em 28/08.
> O diagnóstico era específico: **o servidor respondia em 30 ms**, o HTML
> chegava rápido, e todo o custo estava no que o navegador fazia depois.

**A conta que engana.** A página inteira transferia 387 KiB, mas o Lighthouse
media 13,9 s de main thread. Os dois números só batem quando se percebe que o
custo de CPU é proporcional ao JavaScript **descompactado**: o chunk da cena 3D
tinha 236 KB comprimidos e **887 KB** depois de descompactar (hoje, depois da
troca por `createRoot`, são 183 KB e 708 KB). Peso de rede e
trabalho de CPU são contas diferentes.

**As quatro regras que saíram disso:**

| Regra | Onde vive | Por quê |
| --- | --- | --- |
| `lazy()` separa o chunk, **não adia o download** | `landing/Scene3D.jsx` | O componente montava com o Hero, então o pedido saía no primeiro instante. Era caminho crítico com outro nome |
| Decoração cara é **opcional por aparelho** | `Scene3D.decidirModo()` | Tela < 1024px, `saveData`, 2g/3g, ≤ 2 núcleos ou `reduce-motion` recebem a `Scene2D` (SVG + CSS, custo de JS zero) |
| `@import` de CSS externo cria **cadeia serial** | `index.html` | `preconnect` economiza handshake, não descoberta. O CSS de fonte agora é `<link>` com `media="print"`/`onload` |
| `manualChunks` **vence** `import()` dinâmico | `vite.config.js` | Os caminhos casam `/node_modules/<pacote>/` inteiro. A regra antiga (`/react/`) arrastava `@sentry/react` para o `vendor-react` |
| **O custo de uma cena WebGL é por PIXEL**, não por byte nem por objeto | `scene3d/LandingScene.jsx` | Cinco chamadas de desenho por quadro, e ainda assim a thread principal ficava 99% ocupada. A correção que saiu disso foi desfeita — ver abaixo |

**Toda espera precisa de teto absoluto.** As duas esperas introduzidas aqui —
a cena 3D e o Sentry — liberam sozinhas se o gatilho não vier. A primeira
versão da cena esperava o evento `load`, que só dispara quando todo recurso
inicial termina: com o Google Fonts inalcançável, `readyState` ficou em
`interactive` por 9 s e a cena nunca montou. Enfeite que some não gera erro,
não gera log e não quebra teste — é a falha silenciosa do `CLAUDE.md` §1.5.

**Resultado medido no build** (o antes/depois de campo depende de rodar o
Lighthouse no mesmo aparelho):

| | Antes | Depois |
| --- | --- | --- |
| JS inicial (`index` + `vendor-react`) | 541,7 kB | **458,3 kB** |
| Cena 3D no caminho crítico | 887 kB | **0** (depois do ocioso, e só no desktop) |
| Prints da landing | 227 KB | **94 KB** |
| Sentry | dentro do chunk inicial | 85 kB, sob demanda |

### `[29/08]` A conta que faltava: o custo por PIXEL da cena 3D

As otimizações acima mexeram em **bytes**, e o dono continuou vendo 58 no
PageSpeed do desktop, com 31,3 s de thread principal — dos quais 30.182 ms em
"Other". Byte não explicava aquilo.

Medido num navegador de verdade (`PerformanceObserver` de `longtask`, janela de
8 s com o Hero na tela, build de produção):

| Configuração | Quadros | Long tasks | Thread bloqueada |
| --- | --- | --- | --- |
| `dpr [1, 1.5]` + `antialias` (como estava) | 88 | 88 | **8.066 ms de 8.000 ms** |
| `dpr 1`, sem `antialias` | 133 | 132 | 7.897 ms |
| `dpr 0,75` | 182 | 9 | 468 ms |
| `dpr 0,5` | 243 | **0** | **0 ms** |
| resolução adaptativa (como está) | 236 | 1 | 52 ms |

A thread principal ficava **99% ocupada** enquanto a cena estivesse visível, e
cada quadro isolado passava dos 50 ms que definem uma long task — a mesma conta
do TBT. Não é um degrau, é um penhasco, porque o custo é proporcional a pixel.

Isso também resolve a contradição dos dois PageSpeed do dono: o do **celular**
marcou TBT **0 ms** e o do **desktop**, 31 s. Não é inconsistência de medição —
a cena não sobe abaixo de 1024px (`lib/cena3D.js`), então o celular nunca pagou
por ela.

> **`[29/08]` A resolução adaptativa foi DESFEITA, e é o registro que importa.**
>
> Ela zerava as long tasks da tabela acima — e o dono reprovou em três rodadas,
> testando no celular e no PC: *"começa muito pixelada"*, *"a luz verde não fica
> tão forte"*, *"o raio às vezes é cortado pela metade"*.
>
> O erro foi de método, não de implementação: eu estava otimizando o número do
> Lighthouse contra a coisa que o número existe para medir. Para a ferramenta,
> cena feia e cena bonita valem igual.
>
> O `dpr` e o `antialias` voltaram a ser exatamente os de antes. **O que ficou**
> é o que é invisível e está medido: o laço parado fora da tela, e o chunk 20%
> menor. Ver [DECISOES.md](DECISOES.md).

**No mesmo lote:** o `HUB` do título da landing — que é o **elemento de LCP** —
animava `text-shadow`, que não roda no compositor. Era o "1 elemento animado"
do aviso "Evitar animações não compostas": o maior texto da página repintado na
thread principal, 60 vezes por segundo, para sempre. Agora o brilho é estático
e só a `opacity` anima.

---

## 🎨 Convenções de código

Detalhadas no `CLAUDE.md`. Resumo:

- **Animações** via variantes compartilhadas em `src/lib/motion.js` para o site
  (`fadeTab`, `gridContainer`/`gridCard`, `listContainer`/`listItem`); variantes
  exclusivas da landing em `src/lib/landingMotion.js` (`heroTitle`, `heroFade`,
  `fadeUpReveal`, `staggerContainer`, `expandPanel`). Não duplicar.
  Transição de página global com `PageTransition` + `AnimatePresence`.
- **Ícones**: Lucide para UI; `react-icons/fa6` para marcas.
- **Modais** estilizados via `createPortal` (sem `window.prompt/confirm`).
- Tema em `src/index.css` (classes `.card`, `.btn-neon/.btn-solid/.btn-purple`,
  `.tag-*`, `.input-gamer`).
- **Arquivos pequenos**: ~300 linhas como guia; extrair UI repetida em
  componentes, lógica em hooks/utils, acesso a dados em services.
- **Testes** unitários da lógica pura em `src/lib/__tests__/` (Vitest).
  RPCs/RLS validadas em transação `DO`/`ROLLBACK` antes de aplicar em produção.


---

[← voltar para o README](../README.md)
