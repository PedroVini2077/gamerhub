/**
 * O conteúdo da página "Sobre".
 *
 * ── De onde veio este texto ─────────────────────────────────────────────────
 *
 * Do dono, em 29/08, em resposta às perguntas que a página deixou marcadas como
 * pendentes. A voz é dele; o que eu fiz foi organizar o fluxo, juntar as
 * respostas soltas nos blocos certos e cortar repetição.
 *
 * **O que NÃO foi inventado:** a origem, a trajetória, os jogos, o espírito da
 * comunidade e o rumo do projeto. Tudo isso saiu da resposta dele. Antes de ela
 * chegar, esses blocos ficaram VISÍVEIS na tela como pendentes — inventar
 * ficaria plausível, ele leria, aceitaria por parecer certo, e o site passaria a
 * contar uma origem que não aconteceu.
 *
 * **Uma correção que a resposta dele trouxe:** eu tinha perguntado "o que
 * faltava nos lugares que você já usava", pressupondo que o projeto nasceu de
 * uma frustração. Não nasceu. A resposta foi direta — *"os lugares que eu usava
 * não faltava nada, eu fiz por curiosidade"* — e o texto reflete isso.
 *
 * ── Como mexer ──────────────────────────────────────────────────────────────
 *
 * Cada bloco vira uma seção da página, na ordem desta lista. `pendente: true`
 * troca o texto por um aviso na tela dizendo o que falta ali.
 *
 * ── Os campos ───────────────────────────────────────────────────────────────
 *
 * `icone`   nome de um ícone do `lucide-react`, resolvido pelo mapa em
 *           `iconesDoSobre.js`. OBRIGATÓRIO, e há teste que falha se faltar —
 *           bloco sem ícone sairia com um buraco no lugar dele, e ninguém
 *           repara num buraco (§1.5).
 * `jogos`   lista de `{ nome, genero }`. Vira um mural de chips no lugar de
 *           mais um parágrafo. NÃO usamos capa de jogo: capa é material com
 *           dono (Sony, Konami), e imagem hospedada aqui ainda comeria egress,
 *           que é a cota mais apertada do plano. Ver docs/DECISOES.md.
 */

export const BLOCOS = [
  {
    id: 'o-que-e',
    icone: 'Gamepad2',
    titulo: 'O que é o GamerHub',
    pendente: false,
    paragrafos: [
      'O GamerHub é uma comunidade gamer brasileira reunida num lugar só: um '
      + 'feed colaborativo de dicas, curiosidades e novidades, um mural aberto '
      + 'para conversa, lives do Twitch e do YouTube com chat próprio, keys de '
      + 'jogos grátis e um sistema de ranks que sobe conforme você participa.',
      'A ideia é simples: uma rede social feita para quem joga. Cada parte foi '
      + 'pensada com isso em mente — do jeito que as lives aparecem até como o '
      + 'XP é ganho.',
    ],
  },

  {
    id: 'origem',
    icone: 'Sprout',
    titulo: 'De onde o projeto nasceu',
    pendente: false,
    paragrafos: [
      'O GamerHub não nasceu de uma grande empresa, de uma equipe enorme ou de '
      + 'um plano perfeitamente desenhado. Ele começou de um jeito bem mais '
      + 'simples: curiosidade.',
      'Eu estudo Análise e Desenvolvimento de Sistemas e sempre tive interesse '
      + 'por tecnologia, programação e, claro, por games. Em algum momento '
      + 'surgiu uma pergunta que era quase um desafio pessoal: "até onde eu '
      + 'consigo levar uma ideia dessas?"',
      'E não foi por falta de opção. Os lugares que eu já usava não deviam nada '
      + 'a ninguém — eu só queria construir uma comunidade gamer de verdade, '
      + 'uma rede social feita pra quem joga, e descobrir o que aconteceria se '
      + 'eu tentasse.',
      'No início a ideia era experimentar: construir uma coisa, testar outra, '
      + 'descobrir até onde as ferramentas poderiam chegar e, principalmente, '
      + 'aprender durante o processo. Só que, conforme as ideias foram '
      + 'aparecendo, o projeto foi crescendo — e o que era experimento virou '
      + 'uma plataforma com comunidade, conteúdo, lives, ranks e várias outras '
      + 'partes pensadas para quem gosta de jogar.',
      'Talvez seja isso o que eu mais gosto no GamerHub: ele também é um '
      + 'registro de aprendizado. Cada parte representa alguma coisa que eu '
      + 'quis entender, testar ou construir. Nem tudo saiu perfeito de primeira, '
      + 'e muita coisa ainda vai mudar — mas o projeto continua evoluindo '
      + 'justamente porque eu também estou evoluindo junto com ele.',
    ],
  },

  {
    id: 'quem-faz',
    icone: 'User',
    titulo: 'Quem está por trás',
    pendente: false,
    paragrafos: [
      'Meu nome é Pedro. Sou estudante de Análise e Desenvolvimento de Sistemas '
      + 'e estou construindo minha trajetória em tecnologia, com interesse '
      + 'especial em programação e desenvolvimento back-end. Antes mesmo de '
      + 'pensar no GamerHub como algo grande, programação já era a área que eu '
      + 'queria conhecer de perto.',
      'Minha formação e minhas experiências profissionais me ensinaram coisas '
      + 'diferentes, mas que se encontram aqui: organização, responsabilidade, '
      + 'comunicação, atenção aos detalhes, trabalho em equipe e, '
      + 'principalmente, disposição para aprender.',
      'Sobre o que eu jogo: ação é meu terreno, mas fico preso numa boa '
      + 'história do mesmo jeito — e ficção científica é paixão antiga.',
      'Não estou aqui dizendo que sei tudo — muito pelo contrário. Ainda estou '
      + 'aprendendo, testando, errando, corrigindo e descobrindo muita coisa '
      + 'pelo caminho. E talvez seja justamente isso que torna esse projeto tão '
      + 'especial para mim: ele começou com uma pergunta sobre até onde eu '
      + 'conseguiria chegar, e a resposta ainda está sendo construída.',
    ],
    // Os títulos que ele citou, na ordem em que citou. Viram chips na tela —
    // sem capa de jogo, pelo motivo escrito no cabeçalho deste arquivo.
    jogos: [
      { nome: 'Call of Duty', genero: 'Ação' },
      { nome: 'Battlefield', genero: 'Ação' },
      { nome: 'The Last of Us', genero: 'História' },
      { nome: 'God of War', genero: 'História' },
      { nome: 'Metal Gear Rising: Revengeance', genero: 'O preferido' },
    ],
  },

  {
    id: 'espirito',
    icone: 'HeartHandshake',
    titulo: 'O que a gente espera de quem entra',
    pendente: false,
    // `destaque` dá tratamento visual próprio a este bloco. Ele é o coração da
    // página: é a única parte que fala de PESSOAS, e não de código.
    destaque: true,
    lema: 'Respeito, risos e muito gaming.',
    paragrafos: [
      'O GamerHub é para conversar sobre jogo, trocar dica, rir de derrota, '
      + 'comemorar vitória e conhecer gente que curte o mesmo que você. Se você '
      + 'entrar com essa ideia, já está em casa.',
      'O que não cabe aqui é o de sempre: desrespeito, preconceito e gente que '
      + 'aparece só para estragar o dia dos outros. Não precisa de regulamento '
      + 'gigante para entender isso — precisa de bom senso, e a gente confia '
      + 'que você tem.',
    ],
  },

  {
    id: 'como-cuidamos',
    icone: 'ShieldCheck',
    titulo: 'Como a comunidade é cuidada',
    pendente: false,
    paragrafos: [
      'Todo conteúdo publicado passa por checagem automática antes de ficar '
      + 'visível: texto, imagem, vídeo e links. O que é claramente proibido é '
      + 'ocultado na hora; o que é duvidoso vai para uma fila que uma pessoa '
      + 'revisa.',
      'Nada é banido por robô sozinho. Denúncia de qualquer membro leva o '
      + 'conteúdo para revisão humana, e quem é punido tem como recorrer — o '
      + 'pedido de revisão é um caminho de verdade, não um formulário que some.',
    ],
  },

  {
    id: 'feito-com-ia',
    icone: 'Bot',
    titulo: 'Este site foi construído com inteligência artificial',
    pendente: false,
    paragrafos: [
      'E isso está escrito aqui de propósito, porque faz parte da história.',
      'O código do GamerHub é escrito com a ajuda de uma IA. Mas "feito por IA" '
      + 'não quer dizer "feito sozinho": as decisões, os testes e o gosto são '
      + 'meus. Eu digo o que quero, olho o resultado no meu celular e no meu '
      + 'computador, e mando refazer quando não está bom — e mando refazer com '
      + 'frequência.',
      'Boa parte do que existe aqui nasceu exatamente assim: alguma coisa foi '
      + 'construída, eu testei, não gostei, e a gente desfez. Otimização que '
      + 'deixava a tela feia foi jogada fora. Recurso que não funcionava de '
      + 'verdade foi refeito até funcionar.',
      'Comecei querendo saber até onde uma ferramenta dessas conseguiria ir. '
      + 'O que eu descobri foi outra coisa: até onde uma ideia chega quando '
      + 'alguém decide começar a construí-la.',
    ],
  },

  {
    id: 'para-onde-vai',
    icone: 'Rocket',
    titulo: 'Para onde o GamerHub vai',
    pendente: false,
    paragrafos: [
      'Eu não quero definir um limite pequeno para o GamerHub. A ideia é '
      + 'continuar transformando o projeto num lugar cada vez melhor para quem '
      + 'gosta de games — não apenas adicionando funcionalidades, mas '
      + 'entendendo o que realmente faz uma comunidade gamer ser boa de '
      + 'participar.',
      'O site ainda está em construção. Algumas ideias vão mudar, outras vão '
      + 'nascer no caminho e algumas provavelmente vão ser abandonadas. E tudo '
      + 'bem — a intenção nunca foi criar tudo de uma vez. É construir bem, '
      + 'aprender com o processo e deixar o projeto crescer junto com a '
      + 'comunidade.',
      'O GamerHub começou como um hobby. Agora, quero descobrir até onde ele '
      + 'pode chegar.',
    ],
  },
];
