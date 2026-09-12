import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

/**
 * As travas da CONTINUIDADE — a fatia 7.
 *
 * `[12/09]` O diagnóstico do dono: *"as cenas individualmente estão
 * cinematográficas, mas a página ainda denuncia que são blocos independentes"*.
 * O conserto é costura: as seções se **sobrepõem** e a de cima dissolve a borda.
 *
 * Todas as falhas cobertas aqui são silenciosas por natureza — a página
 * continua abrindo, as cenas continuam bonitas, e o que volta é a sensação de
 * **corte**. Não existe erro para estourar quando uma emenda reaparece.
 */

const FONTE = (c) => readFileSync(c, 'utf8');
const LANDING = 'src/pages/Landing.jsx';
const CENA = 'src/components/landing/CenaDaLanding.jsx';
const COSTURA = 'src/lib/costuraDeCena.js';
const FAIXA = 'src/components/landing/HighlightsStrip.jsx';

describe('o fundo da landing', () => {
  it('o `FluxoDeDados` saiu da landing — mas NÃO do projeto', () => {
    // Ordem do dono: tirar da landing porque *"perdeu relevância diante da nova
    // linguagem visual"*, e ele foi explícito em não remover globalmente.
    // O IMPORT e o JSX, não a palavra: a `Landing` explica num comentário por
    // que ele saiu, e `includes('FluxoDeDados')` casava com a explicação.
    // Provado reinjetando — e é a QUARTA vez nesta sessão que uma trava minha
    // nasce assim. O padrão é sempre o mesmo: o arquivo documenta a regra que
    // o teste vigia, e o teste lê o texto em vez de ler o código.
    const landing = FONTE(LANDING);
    expect(
      /^\s*import .*FluxoDeDados/m.test(landing) || /<FluxoDeDados/.test(landing),
      'A `Landing` voltou a montar o `FluxoDeDados`.\n'
      + '  Com as artes ocupando a tela inteira ele mal aparece, e onde aparece\n'
      + '  disputa com o assunto da cena.',
    ).toBe(false);

    // A outra metade: apagar o componente junto teria sido ir além do pedido.
    const usa = readdirSync('src/components/layout')
      .some((n) => FONTE(`src/components/layout/${n}`).includes('FluxoDeDados'));
    expect(
      usa,
      'Ninguém mais monta o `FluxoDeDados`.\n'
      + '  Ele devia sair da LANDING e continuar no site logado, onde o\n'
      + '  `FundoDaSecao` o usa com a cor de cada seção. Componente sem chamador\n'
      + '  é código morto que ninguém percebe.',
    ).toBe(true);
  });

  it('o ouvinte de ponteiro FICA — a marca do hero depende dele', () => {
    // A armadilha ao remover o fluxo: `usePonteiroDaPagina` foi criado por causa
    // dele, e apagar os dois juntos parece limpeza. A `MarcaFlutuante` lê
    // `--ponteiro-x` no CSS: sem o hook ela simplesmente para de reagir, sem
    // erro nenhum.
    expect(
      FONTE(LANDING),
      'A `Landing` deixou de chamar `usePonteiroDaPagina`.\n'
      + '  A marca do hero para de seguir o ponteiro, e nada acusa: a variável\n'
      + '  CSS tem valor padrão, então o `calc` continua válido e o movimento\n'
      + '  apenas some.',
    ).toContain('usePonteiroDaPagina()');
  });
});

describe('a costura entre as cenas', () => {
  it('a costura tem as DUAS metades — sobreposição E máscara', () => {
    // `[12/09]` A trava passou a ler a LIB: no bloco B a costura saiu de dentro
    // da cena e virou fonte única, porque três componentes precisam dela.
    const cena = FONTE(COSTURA);
    // Uma sem a outra não costura nada:
    //   margem negativa sem máscara .... a borda dura da arte nova aparece por
    //                                    cima da anterior. Fica PIOR que o corte.
    //   máscara sem margem negativa .... a arte dissolve para o vazio, e o corte
    //                                    continua onde estava.
    // `[1-9]` e não `\d`: `-mt-[0vh]` casaria com o dígito genérico e a trava
    // aprovaria uma costura zerada. Provado reinjetando.
    expect(
      /-mt-\[[1-9]\d*vh\]/.test(cena),
      'A cena costurada perdeu a margem negativa.\n'
      + '  Sem sobreposição no LAYOUT não existe transformação possível: duas\n'
      + '  caixas que apenas se tocam só podem trocar de vez.',
    ).toBe(true);
    expect(
      /maskImage/.test(cena) && /WebkitMaskImage/.test(cena),
      'A cena costurada perdeu a máscara do topo (ou o prefixo `-webkit-`).\n'
      + '  É a máscara que apaga a borda de cima — a borda é literalmente o que\n'
      + '  diz "esta imagem acabou aqui". Sem o prefixo, o Safari mostra a borda\n'
      + '  dura e ninguém que testa no Chrome percebe.',
    ).toBe(true);
  });

  it('a costura NÃO acumula com outra entrada', () => {
    // Duas entradas na mesma cena brigam: uma desliza de lado enquanto a outra
    // se dissolve por cima. O resultado é movimento sem leitura — e foi por
    // isso que a cortina e o deslize lateral SAÍRAM quando a costura passou a
    // valer em todas as emendas.
    for (const arq of [CENA, 'src/components/landing/FinalCTA.jsx']) {
      expect(
        /Cortina|entradaDaCena|whileInView/.test(FONTE(arq)),
        `${arq} voltou a ter uma segunda entrada além da costura.\n`
        + '  Invadir a anterior JÁ é a entrada; qualquer coisa por cima disso é\n'
        + '  animar a entrada de uma animação.',
      ).toBe(false);
    }
  });

  it('TODAS as emendas costuram — inclusive a presa e o fecho', () => {
    // A costura numa emenda só deslocaria o corte em vez de matá-lo. São três
    // componentes diferentes, e o que os mantém iguais é a lib compartilhada.
    //
    // Cada linha confere a APLICAÇÃO, não a menção: os três arquivos importam
    // a lib, então procurar o nome dela aprovaria um componente que importa e
    // não usa. Provado reinjetando nos três.
    const aplicam = [
      [CENA, /className=\{`relative overflow-hidden[^`]*\$\{CLASSE_DA_COSTURA\}/],
      [CENA, /style=\{\{ scrollMarginTop: '5rem', \.\.\.estiloDaCostura\(\) \}\}/],
      ['src/components/landing/CenaPresa.jsx', /className=\{CLASSE_DA_COSTURA\}/],
      ['src/components/landing/CenaPresa.jsx', /estiloDoPalco=\{estiloDaCostura\(\)\}/],
      ['src/components/landing/FinalCTA.jsx', /\$\{CLASSE_DA_COSTURA\}`\}/],
      ['src/components/landing/FinalCTA.jsx', /style=\{estiloDaCostura\(\{ fechaEmbaixo: true \}\)\}/],
    ];
    for (const [arq, aplicacao] of aplicam) {
      expect(
        aplicacao.test(FONTE(arq)),
        `${arq} não APLICA a costura (\`${aplicacao.source.slice(0, 46)}…\`).\n`
        + '  Uma emenda sem costura no meio de cinco costuradas é MAIS visível\n'
        + '  do que seis cortes iguais — o olho compara com as vizinhas.',
      ).toBe(true);
    }
  });

  it('a ÚLTIMA cena fecha o pé — ela é a única sem cena depois', () => {
    // `[12/09]` Ele viu no telefone: *"esse corte da última arte com o footer"*.
    //
    // A causa é estrutural: a costura mascara o TOPO da cena que chega. O pé da
    // cena que sai nunca precisou de máscara, porque toda cena era seguida por
    // outra arte que cobria a borda dela. O `FinalCTA` é seguido por NADA — e
    // aí a borda inferior ficou exposta pela primeira vez na página inteira.
    //
    // São TRÊS coisas que precisam ser verdade juntas, e cada uma sozinha
    // devolve o corte em silêncio. Por isso as três estão aqui, e não só a
    // primeira, que seria a fácil de escrever.
    const cta = FONTE('src/components/landing/FinalCTA.jsx');
    const costura = FONTE(COSTURA);

    // 1. a lib sabe fechar embaixo — o gradiente TERMINA transparente
    expect(
      /fechaEmbaixo[\s\S]{0,220}?transparent 100%\)/.test(costura),
      'O gradiente de `fechaEmbaixo` não termina em `transparent 100%`.\n'
      + '  Sem a última parada transparente a máscara é opaca até a borda e o\n'
      + '  corte volta inteiro — com a bandeira ligada, o que é pior: parece\n'
      + '  resolvido em quem for ler o `FinalCTA`.',
    ).toBe(true);

    // 2. o fecho pede o fechamento — e nenhuma outra cena pede
    const pedem = ['src/components/landing/CenaDaLanding.jsx',
      'src/components/landing/CenaPresa.jsx']
      .filter((a) => /fechaEmbaixo/.test(FONTE(a)));
    expect(
      pedem,
      `Uma cena do MEIO pediu \`fechaEmbaixo\` (${pedem.join(', ')}).\n`
      + '  Fechar o pé de uma cena que TEM outra arte depois abre um rasgo de\n'
      + '  fundo entre as duas: a de baixo dissolve o próprio topo e a de cima\n'
      + '  dissolve o próprio pé, e as duas some na mesma faixa.',
    ).toEqual([]);

    // 3. a margem de baixo NÃO voltou
    expect(
      /className=\{`relative overflow-hidden[^`]*\bm[by]-\d/.test(cta),
      'O `FinalCTA` voltou a ter margem embaixo (`my-` ou `mb-`).\n'
      + '  Com margem, a arte dissolve numa faixa VAZIA antes do rodapé em vez\n'
      + '  de dissolver dentro do preto dele: o corte não morre, ele desce\n'
      + '  alguns pixels e vira uma sombra flutuando no nada.',
    ).toBe(false);
  });
});

describe('a ponte do hero para a faixa de destaques', () => {
  it('a faixa INVADE o fim do prólogo', () => {
    const landing = FONTE(LANDING);
    expect(
      /-mt-\[\d+vh\][^"]*max-w-5xl[\s\S]{0,80}<HighlightsStrip/.test(landing),
      'A faixa de destaques voltou a começar depois do prólogo.\n'
      + '  Sem a margem negativa ela aparece num fundo vazio, já depois de o\n'
      + '  hero ter saído — que é exatamente o corte que o dono descreveu:\n'
      + '  "os cards parecem de uma nova página".',
    ).toBe(true);
    expect(
      /z-20[^"]*-mt-\[/.test(landing),
      'A faixa perdeu o `z-20`.\n'
      + '  A cena presa do prólogo vem ANTES no fluxo: sem a camada explícita,\n'
      + '  ela fica por cima e as cartas somem atrás dela.',
    ).toBe(true);
  });

  it('as cartas continuam clicáveis e continuam levando às âncoras', () => {
    const faixa = FONTE(FAIXA);
    // Ele foi explícito: *"os cards continuam clicáveis. Não remover essa
    // funcionalidade"*. Elas são o índice da página, e a página só cresce.
    expect(faixa, 'As cartas deixaram de ser links.').toContain('motion.a');
    expect(faixa, 'As cartas deixaram de apontar para as âncoras.').toContain('alvoDaSecao(id)');
  });

  it('as cartas nunca ficam invisíveis E clicáveis ao mesmo tempo', () => {
    // Elas cedem para o feed entrar, mas opacidade 0 num link é armadilha: a
    // pessoa que navega por Tab cai num destino que não está na tela. É a mesma
    // regra que o prólogo aplica ao hero.
    const faixa = FONTE(FAIXA);
    const saida = faixa.match(/\[0, 1, 1, ([\d.]+)\]/);
    expect(
      saida,
      'Não achei a faixa de opacidade das cartas — a trava ficaria vazia.',
    ).not.toBe(null);
    expect(
      Number(saida[1]),
      'As cartas passaram a sumir por completo ao sair.\n'
      + '  Link invisível continua recebendo clique e foco de teclado.',
    ).toBeGreaterThan(0.1);
  });
});

describe('o rastro da convergência atravessa a emenda', () => {
  const PALCO = 'src/components/landing/PalcoDeRolagem.jsx';
  const CONV = 'src/components/landing/ConvergenciaDoHub.jsx';
  const ARTE = 'src/components/landing/ArteQueInvade.jsx';
  const PROLOGO = 'src/components/landing/PrologoDaLanding.jsx';

  it('o palco recorta só na HORIZONTAL', () => {
    // O dono mandou print: as linhas da convergência terminavam numa borda reta
    // na altura da tela. A causa era `overflow-hidden` no elemento preso —
    // recorta nos dois eixos.
    //
    // `overflow-x-clip` é o único valor que segura a barra horizontal (que a
    // arte ampliada criaria) e deixa o eixo y passar.
    expect(
      /overflow-x-clip \$\{classeDoPalco\}/.test(FONTE(PALCO)),
      'O palco voltou a recortar na vertical.\n'
      + '  As linhas da convergência voltam a ser cortadas numa borda reta na\n'
      + '  altura da tela, e nada acusa — o desenho continua correto, só que\n'
      + '  invisível da metade para baixo.',
    ).toBe(true);
  });

  it('quem recorta a arte é a ARTE, num contêiner sem transformação', () => {
    // A outra metade da troca acima. Sem este contêiner, a arte ampliada
    // (escala até 1,18) transborda para a seção seguinte — e o recorte precisa
    // estar num elemento SEM transformação: aplicado no mesmo que escala, ele
    // recortaria na caixa já ampliada, ou seja, não recortaria nada.
    expect(
      /<div className="h-full overflow-hidden">\s*<motion\.div/.test(FONTE(ARTE)),
      'O `ArteQueInvade` perdeu o contêiner de recorte.\n'
      + '  A arte ampliada passa a vazar para a cena seguinte. Com o palco\n'
      + '  recortando só na horizontal, ninguém mais segura isso.',
    ).toBe(true);
    expect(
      /<div className="absolute inset-0 overflow-hidden">\s*<motion\.div/.test(FONTE(PROLOGO)),
      'A camada da arte do prólogo perdeu o contêiner de recorte.',
    ).toBe(true);
  });

  it('o rastro existe, é usado, e desenha FORA da caixa', () => {
    const conv = FONTE(CONV);
    expect(
      /overflow: 'visible'/.test(conv),
      'A convergência voltou a recortar no próprio `viewBox`.\n'
      + '  Sem `overflow: visible` no `<svg>`, o rastro é desenhado e descartado:\n'
      + '  o SVG recorta na caixa dele antes de qualquer ancestral.',
    ).toBe(true);
    expect(
      /<ConvergenciaDoHub[^/]*rastro/.test(FONTE(PROLOGO)),
      'O prólogo deixou de pedir o rastro.\n'
      + '  O mecanismo existe e as linhas voltam a terminar na borda da tela.',
    ).toBe(true);
  });
});
