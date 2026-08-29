/**
 * O conteúdo da página "Sobre".
 *
 * ── Por que este arquivo existe separado da página ──────────────────────────
 *
 * Porque uma parte dele **não é minha para escrever**. O dono pediu uma aba
 * "sobre o site em si, sobre mim, de onde o projeto nasceu", e ofereceu mandar
 * o texto. Inventar a história dele seria pior do que deixar em branco: ficaria
 * plausível, ele leria, aceitaria por parecer certo, e o site passaria a contar
 * uma origem que não aconteceu.
 *
 * Então o que é FATO sobre o projeto — o que o site faz, como a moderação
 * funciona, o que já foi decidido — está escrito e conferido. O que é história
 * pessoal fica marcado como `PENDENTE`, e a página mostra isso na tela em vez
 * de esconder.
 *
 * ── Como preencher ──────────────────────────────────────────────────────────
 *
 * Troque o `pendente: true` por `false` e escreva os parágrafos. A página passa
 * a mostrar o texto e o aviso some sozinho — não é preciso mexer em mais nada.
 */

export const BLOCOS = [
  {
    id: 'o-que-e',
    titulo: 'O que é o GamerHub',
    pendente: false,
    paragrafos: [
      'O GamerHub é uma comunidade gamer brasileira reunida num lugar só: um '
      + 'feed colaborativo de dicas, curiosidades e novidades, um mural aberto '
      + 'para conversa, lives do Twitch e do YouTube com chat próprio, keys de '
      + 'jogos grátis e um sistema de ranks que sobe conforme você participa.',
      'Não é uma rede social genérica com tema de games: cada parte foi feita '
      + 'pensando em quem joga — do jeito que as lives aparecem até como o XP é '
      + 'ganho.',
    ],
  },
  {
    id: 'origem',
    titulo: 'De onde o projeto nasceu',
    pendente: true,
    dica: 'A ideia, quando surgiu, e o que faltava nos lugares que você já usava.',
  },
  {
    id: 'quem-faz',
    titulo: 'Quem está por trás',
    pendente: true,
    dica: 'Quem é você, o quanto quiser expor — e por que resolveu construir isto.',
  },
  {
    id: 'como-cuidamos',
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
    id: 'para-onde-vai',
    titulo: 'Para onde o GamerHub vai',
    pendente: true,
    dica: 'O que você quer que o site seja daqui a um ano.',
  },
];
