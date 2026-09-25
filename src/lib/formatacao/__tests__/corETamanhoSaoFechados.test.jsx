/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { CORES, TAMANHOS, RECURSOS_COMPLETOS, RECURSOS_DE_COMENTARIO } from '../vocabulario';
import { analisarFormatacao } from '../analisar';
import TextoFormatado from '../../../components/ui/TextoFormatado';

/**
 * `[25/09]` Cor e tamanho vêm de LISTA FECHADA — nunca de valor do usuário.
 *
 * ── O que mudou de natureza nesta fase ────────────────────────────────────
 *
 * Até o editor rico, a formatação só escolhia ENTRE ELEMENTOS: negrito é
 * `<strong>`, e pronto. Cor e tamanho fazem o usuário escolher um **valor**, e
 * valor escolhido por usuário que vira aparência é outra categoria de risco.
 *
 * ── Por que `style` estava fora de cogitação ──────────────────────────────
 *
 * `style={{ color: valorDoUsuario }}` parece seguro — o React recusa CSS
 * malformado. Mas aí a defesa passa a ser "o React trata", que é proteção
 * ACIDENTAL (§1.3): vale por efeito colateral de outra regra, e some no dia em
 * que esse texto for para um e-mail, um PDF, um `<style>` ou um componente que
 * concatene string.
 *
 * O desenho: o usuário escolhe um NOME, o analisador confere contra o mapa, e
 * quem desenha traduz nome → classe do Tailwind. Nenhuma string dele encosta
 * em CSS, em ponto nenhum.
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `corValida` sempre true no analisador -> falhou na cor inventada
 *   . `style` com valor do nó no componente -> falhou na varredura
 *   . `cor` posta nos recursos de comentário -> falhou nomeando o recurso
 */

afterEach(cleanup);

const desenhar = (texto) => render(<TextoFormatado texto={texto} />).container;

describe('cor e tamanho aceitam só o que está no vocabulário', () => {
  it.each(Object.keys(CORES))('a cor %s funciona', (nome) => {
    const c = desenhar(`[cor=${nome}]colorido[/cor]`);
    const span = c.querySelector('span');
    expect(span?.className).toBe(CORES[nome].classe);
    expect(span?.textContent).toBe('colorido');
  });

  it.each(Object.keys(TAMANHOS))('o tamanho %s funciona', (nome) => {
    const c = desenhar(`[tamanho=${nome}]grandão[/tamanho]`);
    expect(c.querySelector('span')?.className).toBe(TAMANHOS[nome].classe);
  });

  it.each([
    ['[cor=vermelhosangue]x[/cor]'],
    ['[cor=inventada]x[/cor]'],
    ['[tamanho=gigantesco]x[/tamanho]'],
    ['[tamanho=999]x[/tamanho]'],
  ])('%s não vira estilo — volta a ser texto', (texto) => {
    const c = desenhar(texto);

    expect(c.querySelector('span'), [
      `"${texto}" produziu um <span> estilizado.`,
      '',
      'O nome não está no vocabulário fechado. Ele não pode virar aparência —',
      'e também não pode SUMIR, porque sumir é o site comendo o que a pessoa',
      'escreveu sem dizer nada (§1.5).',
      '',
      'O certo é o que o §4 chama de mapa explícito: desconhecido volta a ser',
      'texto, com a marcação à mostra.',
    ].join('\n')).toBeNull();

    expect(c.textContent, 'o texto recusado tem de aparecer como foi digitado')
      .toBe(texto);
  });

  it('a árvore carrega o NOME, nunca um valor de CSS', () => {
    const [bloco] = analisarFormatacao('[cor=verde]x[/cor]');
    const no = bloco.filhos[0];
    expect(no.tipo).toBe('cor');
    expect(no.nome, 'o nó guarda o nome escolhido').toBe('verde');
    expect(JSON.stringify(no), [
      'A árvore passou a carregar um valor de cor, não um nome.',
      '',
      'É a diferença entre "o usuário escolheu `verde`" e "o usuário escreveu',
      '`#39ff14`". A segunda forma é uma string dele viajando na direção do',
      'CSS — e é exatamente o que este desenho existe para impedir.',
    ].join('\n')).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|hsl|url\(/i);
  });
});

describe('nenhuma aparência vem de `style` com dado de usuário', () => {
  const ARQUIVOS = [
    'src/components/ui/TextoFormatado.jsx',
    'src/lib/formatacao/analisar.js',
  ];

  it.each(ARQUIVOS)('%s não monta style a partir do nó', (arquivo) => {
    const fonte = readFileSync(arquivo, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');

    expect(fonte, [
      `${arquivo} passou a usar \`style\` com algo vindo do nó.`,
      '',
      'Cor e tamanho têm de sair de um MAPA fechado, como classe. Com `style`,',
      'a defesa passa a ser "o React recusa CSS malformado" — proteção',
      'acidental, que some assim que esse texto for parar em outro contexto.',
    ].join('\n')).not.toMatch(/style=\{\{[^}]*\bno\./);
  });
});

describe('o comentário recebe MENOS poder que o post', () => {
  it('cor e tamanho ficam fora do comentário', () => {
    for (const recurso of ['cor', 'tamanho']) {
      expect(RECURSOS_DE_COMENTARIO, [
        `O recurso \`${recurso}\` entrou nos comentários.`,
        '',
        'Pedido do dono em 25/09: "nem tudo que tem na hora de postar precisa',
        'ter nos comentários". Comentário é conversa — cor e tamanho ali viram',
        'disputa de quem grita mais alto, e a resposta deixa de se distinguir',
        'do post que ela responde.',
      ].join('\n')).not.toContain(recurso);
    }
  });

  it('o que o comentário oferece é um recorte do que o post oferece', () => {
    const forasteiros = RECURSOS_DE_COMENTARIO.filter((r) => !RECURSOS_COMPLETOS.includes(r));
    expect(forasteiros, [
      `O comentário oferece o que o post não oferece: ${forasteiros.join(', ')}`,
      '',
      'A barra do comentário é um RECORTE da do post. Recurso que só existe lá',
      'é recurso que ninguém testou no caminho principal.',
    ].join('\n')).toEqual([]);
  });

  it('nenhuma das duas listas está vazia', () => {
    expect(RECURSOS_COMPLETOS.length).toBeGreaterThanOrEqual(6);
    expect(RECURSOS_DE_COMENTARIO.length).toBeGreaterThanOrEqual(3);
  });
});

describe('as formatações se COMBINAM — bug relatado em 25/09', () => {
  /**
   * O dono relatou: *"combinações de formatações não funcionam, tipo cor +
   * tamanho, fica só a cor e o texto fica normal"*.
   *
   * O analisador estava certo — a árvore aninhava direito. Eram DUAS coisas na
   * renderização, e as duas parecem a mesma de fora:
   *
   *   1. o negrito era `text-gray-200`, e por ser o elemento MAIS INTERNO ele
   *      ganhava do `<span>` de cor. Negrito é PESO, não cor.
   *   2. "Grande" era `text-base` (16px) contra um corpo de `text-sm` (14px).
   *      Dois pixels é indistinguível de "não funcionou".
   */
  it('o negrito NÃO fixa cor — ele herda de quem está por fora', () => {
    const c = desenhar('[cor=verde]**forte**[/cor]');
    const strong = c.querySelector('strong');

    expect(strong?.className, [
      'O negrito voltou a definir uma cor própria.',
      '',
      'Como ele é o elemento mais interno, a cor dele GANHA da cor escolhida',
      'pela pessoa: `[cor=verde]**x**[/cor]` aparece cinza. Foi exatamente o',
      'que o dono relatou como "fica só a cor e o texto fica normal".',
      '',
      'Negrito é peso. Quem decide cor é a cor.',
    ].join('\n')).not.toMatch(/\btext-(gray|white|neon|red|green|blue)/);

    expect(c.querySelector('span')?.className).toBe(CORES.verde.classe);
  });

  it('cor e tamanho convivem, nas duas ordens', () => {
    for (const texto of [
      '[cor=verde][tamanho=grande]x[/tamanho][/cor]',
      '[tamanho=grande][cor=verde]x[/cor][/tamanho]',
    ]) {
      const c = desenhar(texto);
      const classes = [...c.querySelectorAll('span')].map((s) => s.className);
      expect(classes, `"${texto}" perdeu a cor`).toContain(CORES.verde.classe);
      expect(classes, `"${texto}" perdeu o tamanho`).toContain(TAMANHOS.grande.classe);
    }
  });

  it('o degrau "grande" é MAIOR que o corpo do post', () => {
    // O corpo é `text-sm`. Um "grande" que não se vê é o mesmo que nada — e
    // indistinguível de bug, do lado de quem clicou.
    const ordem = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
    const corpo = ordem.indexOf('text-sm');

    expect(ordem.indexOf(TAMANHOS.grande.classe), [
      `"Grande" é ${TAMANHOS.grande.classe}, e o corpo do post é text-sm.`,
      '',
      'Se o degrau não passa do tamanho normal, clicar nele parece não fazer',
      'nada — que foi metade do relato de 25/09.',
    ].join('\n')).toBeGreaterThan(corpo);

    expect(ordem.indexOf(TAMANHOS.enorme.classe))
      .toBeGreaterThan(ordem.indexOf(TAMANHOS.grande.classe));
    expect(ordem.indexOf(TAMANHOS.pequeno.classe)).toBeLessThan(corpo);
  });
});

