/**
 * As regras da comunidade — a página que faltava para a moderação fazer sentido.
 *
 * ── Por que ela existe ──────────────────────────────────────────────────────
 *
 * O GamerHub oculta conteúdo, suspende e bane desde antes desta página. Até
 * agora, **não havia nenhum lugar dizendo qual regra foi quebrada.** Punição
 * sem regra escrita parece arbitrária mesmo quando é justa — e a pessoa punida
 * não tem como corrigir o próprio comportamento se ninguém disse qual era o
 * comportamento esperado.
 *
 * ── De onde vem o conteúdo ──────────────────────────────────────────────────
 *
 * Do que o sistema **realmente faz** (`docs/MODERACAO.md` e
 * `docs/MODERACAO-IA.md`): o que a checagem automática bloqueia, o que vai para
 * fila humana, e como funciona o recurso. Não é lista de bom-tom inventada: se
 * uma regra está escrita aqui, existe mecanismo por trás dela.
 *
 * O espírito veio do dono, e é o mesmo da página "Sobre":
 * **respeito, risos e muito gaming.**
 */

export const LEMA = 'Respeito, risos e muito gaming.';

export const BLOCOS = [
  {
    id: 'espirito',
    titulo: 'O combinado, em uma frase',
    icone: 'HeartHandshake',
    paragrafos: [
      'O GamerHub é para conversar sobre jogo, trocar dica, rir de derrota e '
      + 'comemorar vitória. Se você entra com essa ideia, não precisa decorar '
      + 'regra nenhuma — o resto desta página é para os casos em que alguém não '
      + 'entra com ela.',
    ],
  },

  {
    id: 'nao-cabe',
    titulo: 'O que não cabe aqui',
    icone: 'ShieldCheck',
    paragrafos: [
      'Estas são as linhas que levam a ação da equipe. Elas são poucas de '
      + 'propósito: regulamento gigante ninguém lê, e o que ninguém lê não '
      + 'orienta ninguém.',
    ],
    itens: [
      ['Desrespeito com pessoas', 'ofensa, humilhação, perseguição e ameaça — inclusive "de brincadeira" quando o outro pediu para parar'],
      ['Preconceito', 'racismo, homofobia, transfobia, machismo, capacitismo e xenofobia. Não há versão aceitável disso aqui'],
      ['Conteúdo sexual', 'nudez e conteúdo sexual explícito. O site é de jogos'],
      ['Violência gráfica real', 'jogo é jogo; imagem de violência real não'],
      ['Link perigoso', 'phishing, golpe, malware. Todo link publicado passa por checagem automática'],
      ['Spam e divulgação despejada', 'repetir a mesma mensagem, ou usar a comunidade só como mural de anúncio'],
      ['Conta falsa', 'se passar por outra pessoa ou pela equipe'],
    ],
  },

  {
    id: 'como-funciona',
    titulo: 'Como a moderação funciona de verdade',
    icone: 'Bot',
    paragrafos: [
      'Todo conteúdo passa por checagem automática — texto, imagem, vídeo e '
      + 'links. O que é claramente proibido é ocultado na hora; o que é '
      + 'duvidoso vai para uma fila que uma pessoa revisa.',
      'Nada é banido só por robô. A checagem automática decide o que esconder '
      + 'depressa e o que levar para revisão humana, mas punição de conta é '
      + 'sempre decisão de gente.',
      'Denúncia de qualquer membro leva o conteúdo para revisão. Denunciar não '
      + 'pune ninguém sozinho: ela chama alguém para olhar.',
    ],
  },

  {
    id: 'o-que-acontece',
    titulo: 'O que acontece quando alguém passa da linha',
    icone: 'CalendarClock',
    paragrafos: [
      'A resposta cresce com a gravidade e com a repetição. O primeiro caso '
      + 'quase nunca é o último degrau.',
    ],
    itens: [
      ['Conteúdo ocultado', 'sai do ar e o autor é avisado'],
      ['Suspensão temporária', 'a conta continua, mas fica sem publicar por um tempo'],
      ['Banimento', 'para caso grave ou repetido, e sempre com registro do motivo'],
    ],
  },

  {
    id: 'recurso',
    titulo: 'Se você acha que a equipe errou',
    icone: 'UserCheck',
    paragrafos: [
      'Quem é punido pode pedir revisão. O pedido chega à equipe com o seu '
      + 'texto, e alguém lê — não é um formulário que some.',
      'Toda ação de moderação fica registrada com autor, motivo e data. Isso '
      + 'existe para a equipe conseguir sustentar uma decisão, e para você '
      + 'conseguir contestá-la sabendo do que se trata.',
      'Errar do lado da equipe acontece. É por isso que o caminho de volta '
      + 'existe — e ele é tão parte do sistema quanto a punição.',
    ],
  },
];
