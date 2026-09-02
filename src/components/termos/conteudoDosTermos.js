/**
 * Os Termos de Uso.
 *
 * ── Por que este documento existe separado dos outros dois ──────────────────
 *
 * Cada um responde uma pergunta diferente, e juntá-los faria os três piorarem:
 *
 *   privacidade ..... o que a gente faz com os SEUS DADOS
 *   regras .......... o que você pode PUBLICAR aqui
 *   termos .......... as regras do acordo: de quem é o conteúdo, quando a
 *                     conta é encerrada, e que garantia não existe
 *
 * O terceiro era o único que faltava, e é o único que fala de **contrato**.
 *
 * ── Escrito a partir do que o sistema faz ───────────────────────────────────
 *
 * Mesma regra da política de privacidade: nada aqui é texto de modelo copiado.
 * Cada afirmação corresponde a algo que existe — a exclusão de conta está em
 * Configurações, a moderação está em `docs/MODERACAO.md`, o recurso de
 * banimento está na tela de bloqueio. Termo que promete o que o site não faz é
 * pior do que termo nenhum.
 */

export const ATUALIZADO_EM = '02/09/2026';

export const BLOCOS = [
  {
    id: 'o-acordo',
    titulo: 'O que você está aceitando',
    icone: 'Scale',
    pendente: false,
    paragrafos: [
      'Ao criar uma conta no GamerHub você concorda com estes Termos, com as '
      + 'Regras da Comunidade e com a Política de Privacidade. Os três estão '
      + 'linkados no rodapé de todas as páginas e podem ser lidos a qualquer '
      + 'momento, sem estar logado.',
      'O GamerHub é um projeto independente, gratuito e em construção. Ele não '
      + 'é uma empresa, não cobra nada e não vende nada.',
    ],
  },

  {
    id: 'sua-conta',
    titulo: 'Sua conta',
    icone: 'UserCheck',
    pendente: false,
    paragrafos: [
      'É preciso ter pelo menos 13 anos para criar conta. Esse limite não está '
      + 'só no formulário: o banco de dados recusa qualquer data de nascimento '
      + 'que não o respeite.',
      'A conta é sua e a senha é sua responsabilidade. A gente nunca vai pedir '
      + 'sua senha por mensagem, e-mail ou chat — se alguém pedir, não é a '
      + 'equipe.',
      'Você pode apagar sua conta quando quiser, em Configurações. A exclusão '
      + 'é real: apaga seus posts, seus comentários e seu perfil.',
    ],
  },

  {
    id: 'seu-conteudo',
    titulo: 'O que você publica continua sendo seu',
    icone: 'FileText',
    pendente: false,
    paragrafos: [
      'O que você posta é seu. A gente não reivindica propriedade sobre nada '
      + 'do que você escreve, envia ou transmite aqui.',
      'O que você nos dá é a permissão necessária para o site funcionar: '
      + 'guardar, exibir e distribuir o seu conteúdo dentro do GamerHub, para '
      + 'as outras pessoas verem. Essa permissão acaba quando você apaga o '
      + 'conteúdo ou a conta.',
      'Publicar coisa de terceiro sem direito é sua responsabilidade — imagem, '
      + 'vídeo, música, texto. Se alguém reclamar de um conteúdo por direito '
      + 'autoral, a gente remove.',
    ],
  },

  {
    id: 'moderacao',
    titulo: 'Moderação, suspensão e banimento',
    icone: 'ShieldCheck',
    pendente: false,
    paragrafos: [
      'Conteúdo que quebra as Regras da Comunidade pode ser ocultado, e a '
      + 'conta pode ser suspensa por um prazo ou banida. Parte disso é '
      + 'automática (filtro de palavras e análise de imagem), e parte é '
      + 'decisão de uma pessoa da equipe.',
      'Toda punição pode ser questionada. Quem é banido vê o motivo e tem um '
      + 'pedido de revisão na própria tela de bloqueio. Quem não consegue mais '
      + 'entrar pode usar o formulário de contato, que funciona sem login.',
      'A gente erra. Quando erramos, desfazemos — e é por isso que o caminho '
      + 'de volta existe em todas as punições.',
    ],
  },

  {
    id: 'sem-garantia',
    titulo: 'O que a gente não garante',
    icone: 'AlertTriangle',
    pendente: false,
    paragrafos: [
      'O GamerHub é oferecido como está. Ele roda em serviços de plano '
      + 'gratuito, e isso tem consequências reais: o site pode sair do ar, '
      + 'ficar lento ou perder uma funcionalidade temporariamente.',
      'A gente não garante que o site estará disponível o tempo todo, nem que '
      + 'o conteúdo publicado aqui estará guardado para sempre. Se algo for '
      + 'importante para você, guarde uma cópia.',
      'Isso está escrito porque é verdade, e não porque um advogado mandou. '
      + 'Quando a estrutura mudar, este trecho muda junto.',
    ],
  },

  {
    id: 'mudancas',
    titulo: 'Quando estes termos mudarem',
    icone: 'CalendarClock',
    pendente: false,
    paragrafos: [
      'Cada documento tem uma versão, que é a data da última mudança relevante '
      + 'de conteúdo. Quando você criou a conta, ficou registrado qual versão '
      + 'de cada documento você aceitou e quando.',
      'Mudança de vírgula não muda a versão. Mudança no que a gente coleta, no '
      + 'que você pode fazer, ou no que acontece com a sua conta, muda — e aí '
      + 'você é avisado e precisa aceitar de novo.',
    ],
  },

  {
    id: 'falar-com-a-gente',
    titulo: 'Como falar com a gente',
    icone: 'Mail',
    pendente: false,
    paragrafos: [
      'Pelo formulário em /contato. Ele funciona sem conta e sem login — '
      + 'inclusive para quem foi banido, que é justamente quem mais precisa '
      + 'falar com a equipe.',
    ],
  },
];
