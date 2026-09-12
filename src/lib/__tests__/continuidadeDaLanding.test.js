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
    const cena = FONTE(CENA);
    // Uma sem a outra não costura nada:
    //   margem negativa sem máscara .... a borda dura da arte nova aparece por
    //                                    cima da anterior. Fica PIOR que o corte.
    //   máscara sem margem negativa .... a arte dissolve para o vazio, e o corte
    //                                    continua onde estava.
    expect(
      /-mt-\[\d+vh\]/.test(cena),
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
    const cena = FONTE(CENA);
    // Duas entradas na mesma cena brigam: uma desliza de lado enquanto a outra
    // se dissolve por cima. O resultado é movimento sem leitura.
    expect(
      /const costura = revelacao === 'costura'/.test(cena),
      'A costura deixou de ser um TIPO de revelação e virou um segundo eixo.',
    ).toBe(true);
    expect(
      /!desliza && !costura && <CortinaDaCena/.test(cena),
      'A cena costurada voltou a receber cortina.\n'
      + '  Invadir a anterior JÁ é a entrada; a cortina por cima disso é animar\n'
      + '  a entrada de uma animação.',
    ).toBe(true);
  });

  it('alguma cena realmente usa a costura', () => {
    // Sem isto o mecanismo inteiro poderia existir, ser testado, e não estar
    // montado em lugar nenhum — o mesmo vício da arte órfã.
    expect(
      FONTE(LANDING),
      'Nenhuma cena declara `revelacao="costura"`.\n'
      + '  O mecanismo existe e a página continua com os cortes.',
    ).toContain('revelacao="costura"');
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
