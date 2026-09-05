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

export const ATUALIZADO_EM = '05/09/2026';

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
  'gh_aceite_adiado',
  // `[04/09]` As duas da tela de boas-vindas. Ver `lib/boasVindas.js`.
  'gh_entrando',
  'gh_ja_entrou:',
  // `[05/09]` As três do cofre do painel do Fundador. Ver `lib/cofre.js`.
  // O código em si nunca é guardado — só um resumo SHA-256 com sal.
  //
  // `[05/09]` ELAS ENTRARAM NA TABELA VISÍVEL TAMBÉM, por decisão do dono.
  //
  // Eu tinha proposto o contrário — elas só nascem no aparelho de quem é
  // fundador, e listá-las descreve para milhares de pessoas um armazenamento
  // que existe para uma. Ele decidiu citar, e a razão dele é mais forte que a
  // minha: a tabela abre dizendo "listados abaixo". Lista que se declara
  // completa e não é deixa de ser verdade para quem lê, e o custo de uma
  // política de privacidade menos verdadeira é maior do que o de três linhas a
  // mais.
  //
  // Custou subir a `versao` do documento: todo mundo reaceita.
  'gh_cofre_resumo',
  'gh_cofre_sal',
  'gh_cofre_aberto',
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
  // `[03/09]` NÃO é dependência npm: o Cloudflare Turnstile é um `<script>`
  // buscado em tempo de execução (`lib/turnstile.js`), só na página de contato.
  // Fica escrito aqui porque esta lista é onde se procura "quem recebe alguma
  // coisa" — mas repare que a trava que varre o `package.json` NUNCA o pegaria.
  // Quem vigia terceiro carregado por script é `e2e/terceiro-no-contato.mjs`.
  'cloudflare-turnstile (script, nao e dependencia npm)',
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
      'O que o site guarda no seu navegador são alguns itens de preferência e '
      + 'sessão, listados abaixo. Eles ficam só no seu aparelho.',
    ],
    tabela: {
      titulo: 'O que fica guardado no seu navegador',
      // `[05/09]` As três últimas linhas só nascem no aparelho de quem tem o
      // cargo de fundador. Elas entraram na tabela a pedido do dono: a tabela
      // diz "listados abaixo", e uma lista que se declara completa e não é
      // deixa de ser verdade para quem lê. Custou subir a `versao` do
      // documento — todo mundo reaceita —, e essa foi a escolha dele.
      colunas: ['O que é', 'Para quê', 'Some quando'],
      linhas: [
        ['Sua sessão', 'manter você logado', 'você sai da conta'],
        ['Já vi a abertura', 'não repetir a animação a cada recarga', 'você fecha o navegador'],
        ['Cena 3D ligada/desligada', 'respeitar a sua escolha', 'você limpar o navegador'],
        ['Motivo da pausa', 'explicar direito quando o site sai do ar', 'o site volta'],
        ['Último recarregamento', 'evitar laço de recarregamento', 'você fecha o navegador'],
        ['Sua escolha sobre o som', 'lembrar se você ligou ou DESLIGOU o som da landing', 'você limpar o navegador'],
        ['Aviso de som já visto', 'não repetir o aviso a cada página', 'você fecha o navegador'],
        ['"Ver depois" no aviso de documentos', 'não repetir o pedido de aceite a cada tela', 'você fecha o navegador'],
        ['Marca de "acabou de entrar"', 'mostrar a tela de boas-vindas UMA vez depois do login, e não a cada recarregamento', 'você fecha a aba'],
        ['Marca de "já entrou aqui antes"', 'saber se a saudação é de estreia ou de volta', 'você limpar o navegador'],
        ['Código do cofre da equipe (resumo)', 'destrancar o painel do Fundador neste aparelho — o código em si NUNCA é guardado, só um resumo dele', 'você limpar o navegador'],
        ['Embaralhador do código do cofre', 'fazer o mesmo código gerar resumos diferentes em aparelhos diferentes', 'você limpar o navegador'],
        ['Cofre já aberto nesta aba', 'não pedir o código de novo a cada tela', 'você fecha a aba'],
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
        // `[02/09]` O formulário `/contato` coleta dado de gente que pode nem
        // ter conta aqui. É a única coleta do site que acontece SEM cadastro —
        // omitir isso seria a política descrevendo um site que não é este.
        ['Mensagem no formulário de contato', 'seu nome, e-mail e o relato, para a equipe conseguir responder', 'só se você escrever para a gente'],
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
        ['Cloudflare Turnstile',
          'só na página de contato: é a verificação de "não sou um robô". '
          + 'Recebe seu IP e sinais do navegador para decidir se você é uma '
          + 'pessoa. Não recebe o que você escreveu e não é usado em nenhuma '
          + 'outra página'],
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
    pendente: false,
    paragrafos: [
      'É preciso ter pelo menos 13 anos para usar o GamerHub. A data de '
      + 'nascimento é pedida no cadastro, e quem informar menos de 13 anos '
      + 'não consegue criar a conta — isso é recusado pelo banco de dados, '
      + 'não só pelo formulário.',
      'A diferença importa: o site inteiro roda com uma chave pública, então '
      + 'uma regra que existisse só na tela seria contornável por quem '
      + 'soubesse falar direto com o servidor. Esta não é.',
      'O que a gente NÃO faz é verificar documento. Nada em software impede '
      + 'alguém de digitar uma data falsa, e conferir de verdade exigiria '
      + 'pedir RG — desproporcional para um site como este. O que garantimos é '
      + 'que o limite que está escrito aqui é o mesmo que o sistema aplica.',
      'Se você é responsável por alguém com menos de 13 anos e acha que existe '
      + 'uma conta dessa pessoa aqui, fale com a gente pelo formulário de '
      + 'contato, na opção "Meus dados pessoais".',
    ],
  },

  {
    id: 'por-quanto-tempo',
    titulo: 'Por quanto tempo a gente guarda',
    icone: 'Timer',
    pendente: false,
    paragrafos: [
      'Dado não fica guardado para sempre "porque sim". Cada coisa tem um '
      + 'prazo, e passado esse prazo ela é apagada automaticamente — todo dia, '
      + 'de madrugada, sem ninguém precisar mandar.',
      'Seu perfil e o que você publica não estão nesta tabela: eles ficam '
      + 'enquanto sua conta existir, e somem quando você apagar a conta.',
    ],
    tabela: {
      titulo: 'Prazos de exclusão automática',
      colunas: ['O que', 'Por quanto tempo', 'Por que esse prazo'],
      linhas: [
        ['Tentativas de login', '30 dias',
          'servem para barrar ataque em andamento; tentativa de meses atrás não protege ninguém'],
        ['Registro de moderação', '1 ano',
          'precisa sustentar uma decisão questionada meses depois'],
        ['Mensagens do formulário de contato', '2 anos',
          'apagar cedo demais atrapalharia a própria moderação'],
        ['Notificações já lidas', '30 dias', 'depois disso não aparecem em lugar nenhum'],
        ['Chat de live encerrada', '7 dias', 'a live acabou; o chat dela não serve mais'],
        ['Post na lixeira', '30 dias', 'a janela para a equipe conseguir restaurar'],
      ],
    },
  },

  {
    id: 'contato',
    titulo: 'Como falar com a gente sobre os seus dados',
    icone: 'Mail',
    pendente: false,
    paragrafos: [
      'Existe um formulário em /contato, com uma opção chamada "Meus dados '
      + 'pessoais". Ele funciona sem conta e sem login — inclusive para quem '
      + 'foi banido, que é justamente quem mais precisa falar com a equipe.',
      'A resposta chega no e-mail que você informar. Não temos atendimento em '
      + 'tempo real: é um time pequeno, e pode levar alguns dias.',
      'Guardamos o que você escrever ali, junto do nome e do e-mail, porque '
      + 'sem isso não há como responder. Nada disso vai para anúncio nem para '
      + 'terceiro.',
    ],
  },

  {
    id: 'controlador',
    titulo: 'Quem responde juridicamente por isso',
    icone: 'UserCheck',
    pendente: false,
    paragrafos: [
      'O GamerHub é um projeto pessoal, mantido por uma pessoa física — não há '
      + 'empresa por trás. Quem responde pelos dados tratados aqui é quem '
      + 'mantém o site, e o canal para falar com essa pessoa é o formulário '
      + 'em /contato, na opção "Meus dados pessoais".',
      'É por ali que você pede acesso, correção ou exclusão dos seus dados, e '
      + 'é por ali que a resposta volta, no e-mail que você informar. Não '
      + 'existe um segundo canal escondido: o formulário é o caminho, e ele '
      + 'funciona sem conta e sem login.',
      'Se um dia o projeto deixar de ser pessoal, esta seção muda e você será '
      + 'avisado para aceitar a política de novo — é o mesmo mecanismo que '
      + 'avisou quando os prazos de retenção entraram.',
    ],
  },
];
