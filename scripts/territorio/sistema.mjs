/**
 * O território dos documentos que descrevem o SISTEMA.
 *
 * `[10/10]` Metade do mapa, no corte de `territorio.mjs` (401 linhas, acima do
 * teto de 300 do §4). O mapa inteiro tinha 348 linhas, então cortar
 * "dado × regra" deixaria um arquivo ainda acima do teto — o corte teve de ser
 * DENTRO do mapa.
 *
 * A fronteira é o tipo de documento: aqui estão os que respondem *"como o
 * sistema é"* — privacidade, moderação, banco, segurança, arquitetura, telas,
 * painéis, desempenho e a identidade visual. O outro arquivo
 * (`processo.mjs`) tem os que respondem *"como nós trabalhamos"*.
 *
 * **O recorte é CONTÍGUO de propósito**, e isso não é detalhe: os consumidores
 * iteram o mapa, e o `territorio.mjs` remonta os dois com spread na ordem
 * original. Fatiar por tema em vez de por posição mudaria a ordem dos
 * relatórios sem mudar o conteúdo — diferença que pareceria bug a quem
 * comparasse duas execuções.
 *
 * O cabeçalho que explica o que é um território, e por que lista vazia é
 * diferente de estar fora do mapa, mora em `../territorio.mjs`.
 */
export const SISTEMA = {
  // ── Documentos de produto e de sistema ────────────────────────────────────

  // Privacidade. O território é onde o dado pessoal ENTRA no sistema e por onde
  // ele sai: o cadastro (que coleta data de nascimento), o perfil (que decide o
  // que é público), o cliente do banco, o monitoramento (o que o Sentry recebe)
  // e o `App.jsx`, onde a analítica é montada.
  //
  // `[02/09]` As três últimas entraram depois de um furo real: o PR #140
  // reescreveu o bloco de retenção da política em
  // `src/components/privacidade/` e **nenhum portão esperava** que
  // `PRIVACIDADE.md` fosse junto, porque a pasta não estava aqui. O documento
  // legal e o aceite versionado são território de privacidade por definição.
  'docs/PRIVACIDADE.md': [
    'src/components/auth/RegisterForm.jsx',
    'src/components/profile',
    'src/components/privacidade',
    'src/components/termos',
    'src/lib/documentosLegais.js',
    'src/hooks/useProfileForm.js',
    'src/hooks/useAceitesPendentes.js',
    'src/lib/monitoring.js',
    'src/lib/supabase.js',
    'src/App.jsx',
  ],
  'docs/MODERACAO.md': [
    'src/services/moderationService.js',
    'src/components/moderation',
    'src/components/regras',
    'src/hooks/useBlockedWords.js',
    'supabase/functions/moderate-links',
  ],
  // A política por categoria e os limiares moram nas Edge Functions de mídia —
  // é lá que um piso muda de valor sem ninguém lembrar do documento.
  'docs/MODERACAO-IA.md': [
    'supabase/functions/moderate-image',
    'supabase/functions/moderate-text',
    'src/lib/framesDeVideo.js',
    'src/services/moderationAiService.js',
  ],
  'docs/BANCO.md': [
    'supabase/migrations',
    'src/lib/news',
    'src/services',
    'src/lib/realtimeTables.js',
    'src/lib/tabelasSemUpdate.js',
  ],
  // `[10/09]` A pasta da identidade visual. O território dela é o que EXIBE a
  // marca — se o favicon, o manifesto ou o componente do logo mudarem, o índice
  // das referências precisa ser reconferido. As artes em si são referência
  // artística e não mudam sozinhas; o que envelhece é a relação entre elas e o
  // que o site realmente usa.
  'docs/identidade/README.md': [
    'index.html',
    'public',
    // `[11/09]` Aqui apontava para `Scene2D.jsx`, a cena de fallback — apagada
    // junto com a 3D quando o hero virou `ConvergenciaDoHub`. O que exibe a
    // marca hoje é o componente dela e a abertura, e são esses que fazem o
    // índice das referências envelhecer.
    'src/components/ui/MarcaGH.jsx',
    'src/lib/marca.js',
    'src/components/landing/AberturaDaMarca.jsx',
    'src/components/landing/MarcaFlutuante.jsx',
    'scripts/gerar-icones.mjs',
  ],

  // O registro do que foi REPROVADO. Ele envelhece junto com a marca: se o
  // raio mudar, o motivo de cada tentativa ter sido recusada precisa ser
  // relido antes de alguém repetir a mesma.
  'docs/identidade/tentativas/README.md': [
    'docs/identidade/tentativas',
  ],

  // `[17/09]` A VISÃO de como a landing deve crescer (Prompt 2). Ela é FUTURO e
  // não implementação, então quase nada nela envelhece por commit — com uma
  // exceção: o "retrato de hoje" que ela carrega, e que existe justamente para
  // a evolução saber de onde parte.
  //
  // Território mínimo e não `src/components/landing` inteiro, pela razão de
  // sempre: o retrato é "7 cenas, 6 recortes cada", e é DESTE arquivo que esse
  // número sai. Apontar a pasta toda faria o documento aparecer a cada ajuste
  // de animação, e portão que sempre grita ensina a ignorar o canal.
  'docs/identidade/EVOLUCAO-VISUAL-DA-LANDING.md': [
    'src/lib/cenasDaLanding.js',
  ],

  // `[11/09]` O briefing da reformulacao da marca e da landing. O territorio
  // dele e a LANDING e a tela de entrada — os dois lugares onde a marca aparece
  // para quem chega. No dia em que a direcao for escolhida e implementada, este
  // documento passa a descrever uma decisao tomada em vez de uma em aberto, e
  // precisa ser relido. As imagens de referencia nao mudam sozinhas; o que
  // envelhece e a distancia entre o que ele propoe e o que o site faz.
  'docs/identidade/BRIEFING-2026-09.md': [
    'src/components/landing',
    'src/components/auth',
    'docs/identidade/referencias',
  ],

  // `[11/09]` O briefing da EXPERIENCIA da landing (scroll storytelling). O
  // territorio dele e a landing inteira: no dia em que uma cena for
  // implementada, a distancia entre o que ele propoe e o que o site faz muda, e
  // o documento precisa dizer qual fatia ja saiu do papel.
  //
  // As imagens de referencia dele ainda NAO existem — o dono avisou que vai
  // gerar. Quando chegarem, elas entram em `docs/identidade/referencias` e este
  // caminho passa a valer para as duas coisas.
  'docs/identidade/BRIEFING-LANDING-2026-09.md': [
    'src/pages/Landing.jsx',
    'src/components/landing',
    'docs/identidade/referencias',
  ],

  // `[19/09]` O registro das regras permanentes. O territorio dele sao as
  // TRAVAS: se uma delas muda, a linha que a cita aqui pode ter deixado de ser
  // verdade. Nao inclui `src/` inteiro de proposito — ele nao descreve codigo,
  // descreve regra, e um territorio largo demais o deixaria "atrasado" sempre.
  // `[24/09]` O inventario das travas. Territorio: as pastas de teste E os
  // scripts, porque ele classifica os dois. Portao novo em `scripts/` ou trava
  // nova em `__tests__/` torna este arquivo suspeito — que e o sinal certo.
  'docs/TRAVAS.md': [
    'src/lib/__tests__',
    'scripts',
    'e2e',
    '.github/workflows',
  ],
  // `[24/09]` O indice de decisoes de banco. O territorio dele sao as
  // migrations: decisao de desenho nova nasce la, e este indice precisa
  // crescer no mesmo PR — senao ele vira um retrato de setembro.
  'docs/DECISOES-DE-BANCO.md': [
    'supabase/migrations',
  ],
  // `[24/09]` A Fase 0 do proximo bloco. O territorio e o que ela MEDIU: se o
  // feed, a busca ou o composer mudarem, os numeros dela envelhecem.
  'docs/PLANO-FEED-BUSCA-NEWS.md': [
    'src/pages/Home.jsx',
    'src/services/postService.js',
    'src/components/feed',
  ],
  'docs/INVARIANTES.md': [
    'src/lib/__tests__',
    'src/hooks/__tests__',
    'e2e/portas-do-banco.mjs',
    'e2e/portas-da-web.mjs',
  ],
  'docs/SEGURANCA.md': [
    'supabase/functions',
    'src/hooks/useAuth.jsx',
    'src/hooks/useVigiaDeBanimento.js',
    'src/lib/roles.js',
    'src/lib/url.js',
    'e2e/portas-do-banco.mjs',
    'e2e/portas-fechadas.mjs',
  ],
  'docs/ARQUITETURA.md': [
    'src/App.jsx',
    // `[24/09]` O `index.html` tem DOIS donos de propósito: a `identidade`
    // responde pelos ícones e pelo cartão, e o `ARQUITETURA` pela seção que
    // recebeu a prosa que saía no HTML servido ao visitante. Mudou o HTML, os
    // dois precisam de conferência.
    'index.html',
    'src/paginasLazy.js',
    'src/services',
    'src/hooks',
    'src/lib',
    'src/components/layout',
    'src/components/ui',
  ],
  'docs/FUNCIONALIDADES.md': [
    'src/pages',
    'src/components/landing',
    'src/components/feed',
    // `[25/09]` O GamerHub News é tela que alguém USA, então quem manda nele é
    // o FUNCIONALIDADES. O vocabulário fechado (`src/lib/news/`) fica com o
    // BANCO logo abaixo, porque ele espelha um `CHECK` — quem mexe num tem de
    // abrir o outro.
    'src/components/news',
    'src/components/community',
    'src/components/lives',
    'src/components/keys',
    'src/components/sobre',
    'src/components/conteudo',
    'src/components/contato',
    'src/components/auth',
    // `[12/09]` Nasceu com o SEC-012 (apagar a conta passou a pedir a senha).
    // Fica aqui e nao no SEGURANCA.md porque o que ela descreve e O QUE A TELA
    // FAZ; o porque da senha existir e do territorio de seguranca, e esta
    // escrito la.
    'src/components/conta',
  ],
  // O que a equipe opera. O território dele são os painéis e o caminho de ban.
  'docs/PAINEIS.md': [
    'src/pages/Admin.jsx',
    'src/pages/Owner.jsx',
    'src/components/admin',
    'src/components/owner',
  ],
  'docs/OPERACAO.md': ['.github/workflows', 'scripts'],
  // Investigação de desempenho: envelhece quando o que ela mede muda de forma —
  // o fundo do hero, o orçamento de bytes e o build.
  'docs/DESEMPENHO.md': [
    // `[11/09]` Aqui apontava para `landing/scene3d` e `lib/cena3D.js`, os dois
    // apagados com a cena. O que o `DESEMPENHO.md` mede no hero passou a ser o
    // fundo em SVG e a camada de fluxo — é o custo deles que a próxima medição
    // precisa confrontar.
    //
    // `resolucaoDaCena.js` esteve nesta lista e foi APAGADO no PR #105 ("desfaz
    // a otimização de resolução"). A entrada sobreviveu ao arquivo, e como o
    // relatório pula caminho inexistente, `DESEMPENHO.md` ficou meio vigiado
    // desde então sem nada acusar. É o apodrecimento que o portão de cobertura
    // passou a pegar — e é a mesma armadilha que as duas entradas acima
    // reproduziriam se eu só as tivesse removido sem pôr as sucessoras.
    'src/components/landing/ConvergenciaDoHub.jsx',
    'src/components/landing/FluxoDeDados.jsx',
    'scripts/orcamento-de-bytes.mjs',
    'vite.config.js',
  ],

};
