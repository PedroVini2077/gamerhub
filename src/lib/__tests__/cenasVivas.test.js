import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { getRankFromXP } from '../ranks';

/**
 * As travas das CENAS VIVAS — as sobreposições que a fatia 6 acrescentou.
 *
 * `[12/09]` Todas as falhas cobertas aqui têm a mesma assinatura, e é por isso
 * que precisam de teste: **a landing continua bonita e a cena para de dizer o
 * que deveria dizer**. Nenhuma delas quebra a página, aparece em log ou tem
 * sintoma — o efeito é a pessoa olhar e não sentir nada.
 */

const PASTA = 'src/components/landing/cenas';
const FONTE = (c) => readFileSync(c, 'utf8');
const LANDING = FONTE('src/pages/Landing.jsx');

/** As cinco cenas e o arquivo de cada uma. */
const CENAS = {
  feed: `${PASTA}/SobreposicaoDoFeed.jsx`,
  comunidade: `${PASTA}/SobreposicaoDaComunidade.jsx`,
  lives: `${PASTA}/SobreposicaoDasLives.jsx`,
  keys: `${PASTA}/SobreposicaoDasKeys.jsx`,
  ranks: `${PASTA}/SobreposicaoDosRanks.jsx`,
};

describe('a varredura não pode ficar vazia', () => {
  it('a pasta das sobreposições existe e tem as cinco', () => {
    // Sem isto, renomear a pasta deixaria TODOS os testes abaixo verdes para
    // sempre, lendo arquivo nenhum. É a mesma vacuidade que `varrerFontes.js`
    // fecha nas outras travas do projeto.
    const arquivos = readdirSync(PASTA).filter((n) => n.startsWith('Sobreposicao'));
    expect(
      arquivos.length,
      `Esperava 5 sobreposições em ${PASTA}, achei ${arquivos.length}.\n`
      + '  Se a pasta mudou de lugar, ajuste esta trava — senão ela aprova tudo\n'
      + '  sem olhar nada.',
    ).toBe(5);
  });
});

describe('cada cena tem uma personalidade PRÓPRIA', () => {
  it('nenhuma cena entra com o mesmo `fadeUpReveal` da anterior', () => {
    // A ordem exata do prompt do dono: *"não quero cinco fades iguais"*. A
    // deriva aqui é lenta e silenciosa — alguém acrescenta uma cena copiando a
    // de cima, e em três meses são cinco de novo.
    const revelacoes = [...LANDING.matchAll(/revelacao="([a-z]+)"/g)].map((m) => m[1]);
    expect(
      revelacoes.length,
      'Nenhuma cena declara `revelacao` na Landing.',
    ).toBeGreaterThanOrEqual(3);
    expect(
      new Set(revelacoes).size,
      `As cenas soltas voltaram a compartilhar revelação: ${revelacoes.join(', ')}.\n`
      + '  Cinco seções entrando igual é exatamente o que o dono mandou\n'
      + '  eliminar, e é invisível numa revisão de código: cada linha está\n'
      + '  certa, o conjunto é que fica monótono.',
    ).toBe(revelacoes.length);

    expect(
      LANDING.includes('fadeUpReveal'),
      'A `Landing` voltou a usar `fadeUpReveal` diretamente.',
    ).toBe(false);
  });

  it('as cenas presas são DUAS — nem zero, nem cinco', () => {
    const presas = (LANDING.match(/<CenaPresa/g) ?? []).length;
    const soltas = (LANDING.match(/<CenaDaLanding/g) ?? []).length;
    expect(
      presas,
      'O número de cenas presas mudou.\n'
      + '  Zero: a landing perdeu os dois momentos de transformação e virou uma\n'
      + '  sequência de seções de novo.\n'
      + '  Cinco: são ~13 telas de rolagem a mais, que é o que o dono chamou de\n'
      + '  "cinco mini-sites consecutivos".\n'
      + '  Se a mudança é deliberada, mude este número E escreva o porquê.',
    ).toBe(2);
    expect(presas + soltas, 'A landing deixou de ter cinco cenas.').toBe(5);
  });

  it('toda cena solta declara a sobreposição dela', () => {
    // Cena sem sobreposição volta a ser "uma foto com um texto ao lado" — e o
    // arquivo da sobreposição continua no repositório, sem chamador, parecendo
    // que a funcionalidade existe.
    for (const [nome, caminho] of Object.entries(CENAS)) {
      const componente = caminho.split('/').pop().replace('.jsx', '');
      expect(
        LANDING.includes(`<${componente}`),
        `A cena "${nome}" não monta \`${componente}\`.\n`
        + '  A sobreposição virou arquivo órfão: ela existe, é testada, e\n'
        + '  ninguém a vê. Já aconteceu com `CENAS.hero`.',
      ).toBe(true);
    }
  });
});

describe('o movimento nasce do produto, e não do catálogo', () => {
  it('o FEED não depende da rolagem — atividade que para não é atividade', () => {
    const feed = FONTE(CENAS.feed);
    expect(
      /progresso/.test(feed),
      'O feed passou a ser conduzido pela rolagem.\n'
      + '  Aí a atividade PARA quando a pessoa para de rolar, e a cena passa a\n'
      + '  dizer "isto acontece quando você mexe" — o oposto de uma comunidade\n'
      + '  viva. Ela é por TEMPO de propósito.',
    ).toBe(false);
    expect(feed).toContain('setTimeout');
  });

  it('o chat das LIVES para quando ninguém está vendo', () => {
    const lives = FONTE(CENAS.lives);
    // `useInView` COM `once` desligaria a vigilância: o relógio ligaria uma vez
    // e nunca mais pararia. É o custo silencioso que a cena 3D cobrou em
    // 29.441 ms de thread principal.
    expect(
      /useInView\(caixa, \{ amount/.test(lives),
      'O chat das lives perdeu o `useInView` sem `once`.\n'
      + '  Com `once`, o `setInterval` liga ao entrar na tela e NUNCA MAIS PARA:\n'
      + '  ele continua rodando para quem já rolou até o rodapé, para sempre.\n'
      + '  Nada trava, nada acusa — só a bateria de quem visita.',
    ).toBe(true);
    expect(lives).toContain('clearInterval');
  });

  it('os RANKS leem o sistema de verdade, e atravessam uma fronteira real', () => {
    const ranks = FONTE(CENAS.ranks);
    expect(
      ranks.includes('getRankFromXP'),
      'A cena de ranks passou a escrever os rótulos à mão.\n'
      + '  No dia em que os limites de XP mudarem, a landing vai prometer um\n'
      + '  sistema que não existe mais — e nada acusa, porque a página continua\n'
      + '  bonita (§1.4).',
    ).toBe(true);

    const inicial = Number(ranks.match(/XP_INICIAL = (\d+)/)[1]);
    const final = Number(ranks.match(/XP_FINAL = (\d+)/)[1]);
    expect(
      getRankFromXP(inicial).tier,
      `XP ${inicial} e ${final} caem no MESMO rank.\n`
      + '  A cena inteira existe para mostrar uma subida de rank. Com os dois\n'
      + '  números do mesmo lado da fronteira, a barra enche, o selo não muda,\n'
      + '  e a promessa "eu estou evoluindo" some sem erro nenhum.',
    ).not.toBe(getRankFromXP(final).tier);
  });
});

describe('o custo e a acessibilidade', () => {
  it('nenhuma sobreposição usa filtro caro sobre a arte', () => {
    // `blur`/`drop-shadow` animados repintam a cada quadro sobre uma imagem que
    // ocupa a faixa inteira. É o travamento clássico de celular, e é invisível
    // em máquina de desenvolvimento.
    for (const [nome, caminho] of Object.entries(CENAS)) {
      expect(
        /filter:\s*['"`]?(blur|drop-shadow)/.test(FONTE(caminho)),
        `A sobreposição de "${nome}" passou a animar um filtro.\n`
        + '  Filtro é repintado por quadro; `transform` e `opacity` são\n'
        + '  compostos. A diferença só aparece no celular de quem visita.',
      ).toBe(false);
    }
  });

  it('quem pediu menos movimento continua vendo as cenas', () => {
    // As sobreposições por TEMPO precisam checar `useReducedMotion` elas
    // mesmas; as conduzidas por rolagem recebem um progresso congelado em 1 do
    // `CenaPresa`, e por isso não precisam checar nada.
    for (const nome of ['feed', 'lives']) {
      expect(
        FONTE(CENAS[nome]).includes('useReducedMotion'),
        `A sobreposição de "${nome}" deixou de olhar \`prefers-reduced-motion\`.\n`
        + '  Ela tem relógio próprio: sem a checagem, quem desligou animação no\n'
        + '  sistema recebe exatamente o movimento que pediu para não ver.',
      ).toBe(true);
    }
    const presa = FONTE('src/components/landing/CenaPresa.jsx');
    expect(
      /useMotionValue\(1\)/.test(presa),
      'A `CenaPresa` perdeu o progresso congelado.\n'
      + '  Sem ele, quem pediu menos movimento vê a sobreposição no estado\n'
      + '  INICIAL — ou seja, a cena vazia, com a história por acontecer.',
    ).toBe(true);
  });

  it('a sobreposição não intercepta clique', () => {
    // A CLASSE aplicada, não a palavra no arquivo: o comentário do próprio
    // componente explica por que ele é `pointer-events-none`, e `toContain`
    // casava com a explicação. Provado reinjetando — a primeira versão desta
    // trava passou verde com a classe removida do elemento.
    expect(
      /className=\{`absolute inset-0 pointer-events-none/.test(FONTE(`${PASTA}/PainelDaCena.jsx`)),
      'O painel das cenas deixou de ser `pointer-events-none`.\n'
      + '  Ele cobre a arte inteira: virando clicável, ele engole o clique de\n'
      + '  qualquer coisa embaixo, e o defeito só aparece para quem tentar.',
    ).toBe(true);
  });
});
