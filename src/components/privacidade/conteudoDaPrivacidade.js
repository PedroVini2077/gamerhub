/**
 * O conteúdo da página `/privacidade`.
 *
 * ── De onde vem cada frase ──────────────────────────────────────────────────
 *
 * Do levantamento técnico em `docs/PRIVACIDADE.md`, feito em 01/09 medindo a
 * implementação real: navegador aberto para ver cookie e armazenamento,
 * consultas ao banco para ver colunas, e leitura do código para ver o que sai
 * para terceiros.
 *
 * **Nada aqui é texto de modelo.** Política copiada de outro site descreve um
 * site que não é este, e uma política que descreve errado é pior do que
 * nenhuma: ela promete o que o sistema não faz.
 *
 * ── O que está marcado como pendente, e por que ─────────────────────────────
 *
 * Prazo de retenção, identidade do controlador e canal de contato dependem de
 * decisão do dono — de negócio e jurídica. Eles aparecem na tela **marcados**,
 * em vez de preenchidos por palpite: uma política que inventa prazo é uma
 * promessa que ninguém prometeu.
 *
 * `pendente: true` faz o bloco aparecer com o aviso, igual à página "Sobre".
 */

export const ATUALIZADO_EM = '01/09/2026';

/**
 * ── AS LISTAS QUE O SITE NÃO PODE CRESCER SEM ATUALIZAR ─────────────────────
 *
 * Pedido do dono em 01/09: *"o site vai crescer mais, então a gente precisa que
 * essa aba de políticas de privacidade esteja sempre atualizada, sempre mesmo"*.
 *
 * Promessa não serve para isso. Estas duas listas são a versão CONFERÍVEL do
 * que a página afirma, e `conteudoDaPrivacidade.test.js` as cruza com o código:
 * chave de armazenamento nova ou dependência que manda dado para fora reprovam
 * o PR até a política dizer o que passou a acontecer.
 *
 * A tabela acima é para quem lê; estas listas são para a máquina conferir. As
 * duas descrevem a mesma coisa de propósito — o que muda é quem consegue ler.
 */

/** Toda chave que o código do site grava no navegador. */
export const CHAVES_DECLARADAS = [
  'gh_intro_vista',
  'gh_landing_3d',
  'gh_pause_reason',
  'gh_chunk_reload_at',
  'gh_som_ambiente',
  'gh_som_avisado',
];

/**
 * Toda dependência que envia dado para fora.
 *
 * O critério é "manda alguma coisa para um servidor de terceiro", não "é
 * biblioteca externa": `framer-motion` anima e não fala com ninguém, então não
 * entra. O que entra é o que faz uma pessoa aparecer no registro de outra
 * empresa.
 */
export const TERCEIROS_DECLARADOS = [
  '@supabase/supabase-js',
  '@sentry/react',
  '@vercel/analytics',
  '@vercel/speed-insights',
];

export const BLOCOS = [
  {
    id: 'resumo',
    titulo: 'O resumo, em três linhas',
    icone: 'ShieldCheck',
    pendente: false,
    paragrafos: [
      'O GamerHub não usa cookies, não tem rastreador de publicidade e não '
      + 'vende nem compartilha seus dados com anunciante nenhum.',
      'O que a gente guarda é o necessário para você ter uma conta e para a '
      + 'comunidade ser moderada: seu e-mail, seu perfil e o que você publica.',
      'Você pode apagar sua conta a qualquer momento, pelas configurações, e '
      + 'isso remove seus dados de verdade — não é um pedido que fica na fila.',
    ],
  },

  {
    id: 'cookies',
    titulo: 'Cookies: o site não usa nenhum',
    icone: 'Cookie',
    pendente: false,
    paragrafos: [
      'Isto não é uma forma de falar. O site foi medido com um navegador '
      + 'limpo e nenhum cookie foi criado — nem nosso, nem de terceiro.',
      'É por isso que você não vê aqui aquela faixa pedindo para aceitar '
      + 'cookies. Ela existiria para pedir permissão de uma coisa que não '
      + 'acontece.',
      'O que o site guarda no seu navegador são cinco itens de preferência e '
      + 'sessão, listados abaixo. Eles ficam só no seu aparelho.',
    ],
    tabela: {
      titulo: 'O que fica guardado no seu navegador',
      colunas: ['O que é', 'Para quê', 'Some quando'],
      linhas: [
        ['Sua sessão', 'manter você logado', 'você sai da conta'],
        ['Já vi a abertura', 'não repetir a animação a cada recarga', 'você fecha o navegador'],
        ['Cena 3D ligada/desligada', 'respeitar a sua escolha', 'você limpar o navegador'],
        ['Motivo da pausa', 'explicar direito quando o site sai do ar', 'o site volta'],
        ['Último recarregamento', 'evitar laço de recarregamento', 'você fecha o navegador'],
        ['Som ambiente ligado', 'lembrar que você ligou o som da landing', 'você desliga o som'],
        ['Aviso de som já visto', 'não repetir o aviso a cada página', 'você fecha o navegador'],
      ],
    },
  },

  {
    id: 'o-que-guardamos',
    titulo: 'O que a gente guarda, e por quê',
    icone: 'Database',
    pendente: false,
    paragrafos: [
      'Cada dado abaixo existe por um motivo concreto. O que é opcional está '
      + 'marcado como opcional — e opcional aqui quer dizer que o site '
      + 'funciona inteiro sem ele.',
    ],
    tabela: {
      titulo: 'Seus dados',
      colunas: ['Dado', 'Por que existe', 'Obrigatório?'],
      linhas: [
        ['E-mail', 'entrar na conta e recuperar a senha', 'sim'],
        ['Senha', 'guardada cifrada; nem a equipe consegue lê-la', 'sim'],
        ['Nome de usuário, foto e bio', 'sua identidade na comunidade', 'só o nome'],
        ['Data de nascimento', 'calcular sua idade', 'sim — e a data em si nunca aparece no seu perfil, só a idade'],
        ['Estado, plataforma, jogos, estilo', 'seu perfil gamer', 'opcional'],
        ['Discord, Twitch, YouTube', 'links que você quiser mostrar', 'opcional'],
        ['O que você publica', 'é o conteúdo do site', 'seu, e você apaga quando quiser'],
        ['Registro de moderação', 'trilha de auditoria de punições e recursos', 'sim, quando houver'],
      ],
    },
  },

  {
    id: 'terceiros',
    titulo: 'Quem mais vê alguma coisa',
    icone: 'Share2',
    pendente: false,
    paragrafos: [
      'Nenhum deles recebe dado seu para fazer publicidade. Todos são peças '
      + 'de infraestrutura do site.',
    ],
    tabela: {
      titulo: 'Serviços que o site usa',
      colunas: ['Serviço', 'O que ele recebe'],
      linhas: [
        ['Supabase', 'é o banco de dados e o sistema de login — tudo acima fica lá'],
        ['Vercel', 'hospeda o site; recebe seu IP no registro de acesso, como qualquer servidor'],
        ['Vercel Analytics', 'quantas visitas cada página teve, sem cookie e sem identificar você'],
        ['Sentry', 'erros do site. Recebe seu id e seu nome de usuário — nunca seu e-mail'],
        ['Google Fonts', 'as fontes do site vêm de lá, e isso entrega seu IP ao Google'],
      ],
    },
  },

  {
    id: 'seus-direitos',
    titulo: 'Seus direitos, e como usar cada um',
    icone: 'UserCheck',
    pendente: false,
    paragrafos: [
      'A LGPD garante que você possa saber o que existe sobre você, corrigir o '
      + 'que estiver errado e pedir para apagar. No GamerHub isso não é '
      + 'formulário: é botão.',
      'Ver e corrigir: tudo que a gente guarda sobre você aparece na sua '
      + 'página de perfil, e você edita ali mesmo.',
      'Apagar: em Configurações existe a exclusão de conta. Ela apaga de '
      + 'verdade — seus posts, seus comentários e seu perfil.',
      'O que fica mesmo depois disso são registros de moderação, quando houver '
      + 'punição. Eles existem para a equipe conseguir sustentar uma decisão, '
      + 'e a gente prefere dizer isso do que esconder.',
    ],
  },

  {
    id: 'menores',
    titulo: 'Idade mínima',
    icone: 'CalendarClock',
    pendente: true,
    dica: 'Falta a decisão do dono sobre o piso de idade (13, 16 ou 18 anos). '
      + 'Hoje o cadastro exige 13 no formulário, mas o banco ainda não impõe '
      + 'esse limite — está no BACKLOG.md como item 🟡, com a consulta de '
      + 'dimensionamento pronta.',
  },

  {
    id: 'por-quanto-tempo',
    titulo: 'Por quanto tempo a gente guarda',
    icone: 'Timer',
    pendente: true,
    dica: 'Falta definir o prazo de retenção do registro de tentativas de '
      + 'login e da trilha de moderação. Ambos guardam dado pessoal e hoje '
      + 'não têm prazo — item 🔵 no BACKLOG.md.',
  },

  {
    id: 'contato',
    titulo: 'Quem responde por isso, e como falar com a gente',
    icone: 'Mail',
    pendente: true,
    dica: 'Falta o dono definir quem é o controlador dos dados e qual o canal '
      + 'de contato para pedidos de privacidade. É dado pessoal dele — só ele '
      + 'decide o que expor.',
  },
];
