import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { RECEITAS, receitaDeInstalacao } from '../comoInstalar.js';

/**
 * `[09/10]` A ENTRADA FIXA "Instalar o app", e o defeito que ela nasceu tendo.
 *
 * ── O caso real, com dez minutos de vida em produção ───────────────────────
 *
 * A 1ª versão da entrada só aparecia quando o navegador já tinha oferecido o
 * convite. Parecia o certo — botão que não faz nada é pior do que botão
 * nenhum. Ele abriu a gaveta, não viu a entrada, e perguntou:
 *
 *     "Tem certeza que foi pra produção?"
 *
 * Tinha ido: o chunk da landing em produção batia por hash com o build local e
 * continha a string. **O recurso estava no ar e invisível.**
 *
 * ── Por que isso é §1.5, e não um detalhe de UI ────────────────────────────
 *
 * "Nada" tinha TRÊS causas, e a tela não distinguia nenhuma:
 *
 *     o deploy não chegou  ·  o navegador não ofereceu  ·  o aparelho não pode
 *
 * Os três canais davam "nada": a pessoa não vê, nada fica gravado, nenhum
 * teste falha. As travas provavam o contrato do código, não que alguém
 * conseguiria instalar.
 *
 * ── As duas perguntas, que continuam diferentes ────────────────────────────
 *
 * | pergunta | quem faz | respeita a decisão guardada? |
 * | --- | --- | --- |
 * | `devoConvidar()` | a FAIXA, que aparece sozinha | **sim** — insistir é o defeito |
 * | `podeInstalar()` | a ENTRADA, que é procurada | **não** — esconder é o defeito |
 *
 * ── E a receita não pode CHUTAR ────────────────────────────────────────────
 *
 * Sem convite, a entrada explica como instalar. Mandar alguém no Windows
 * "tocar em Compartilhar" é pior do que não dizer nada: a pessoa procura um
 * botão que não existe e conclui que o site está quebrado. Por isso o mapa é
 * explícito e o desconhecido é uma RECEITA de verdade (§4).
 */

const BARRA = 'src/components/landing/LandingSidebar.jsx';
const PAINEL = 'src/components/ui/ComoInstalar.jsx';

describe('a entrada de instalação não some nem chuta', () => {
  it('a barra lateral da landing tem a entrada, e ela pergunta o CERTO', () => {
    const jsx = readFileSync(BARRA, 'utf8');

    expect(
      /podeInstalar/.test(jsx) && /abrirConvite/.test(jsx),
      'a entrada "Instalar o app" saiu da barra lateral da landing.\n'
      + 'Ela é a porta permanente: sem ela, quem dispensa a faixa fica sem\n'
      + 'nenhuma — e a faixa aparece UMA vez só.',
    ).toBe(true);

    // Esta checagem já exigiu o CONTRÁRIO — que a entrada só aparecesse com o
    // convite em mãos. Foi o que a deixou invisível em produção.
    expect(
      /\{!estaInstalado\(\) && \(/.test(jsx),
      'a entrada voltou a SUMIR quando o navegador não ofereceu o convite.\n'
      + 'Foi assim que ela ficou invisível em produção e passou por deploy que\n'
      + 'não chegou. O único caso de ausência honesta é quem já abriu pelo app\n'
      + 'instalado: ali a pessoa está dentro do que o botão ofereceria.',
    ).toBe(true);

    expect(
      /setMostrarComo\(true\)/.test(jsx) && /ComoInstalar/.test(jsx),
      'o clique sem convite voltou a não fazer NADA.\n'
      + 'Entrada que existe e não responde é pior do que entrada nenhuma — e é\n'
      + 'o caso do iPhone, onde o Safari não implementa o evento, e o de quem\n'
      + 'já instalou. Sem convite, o certo é dizer onde a opção mora.',
    ).toBe(true);

    expect(
      /devoConvidar/.test(jsx),
      'a barra lateral passou a perguntar `devoConvidar()`.\n'
      + 'Essa é a pergunta da FAIXA, e ela respeita a decisão guardada — o que\n'
      + 'faz a entrada fixa DESAPARECER justamente para quem dispensou a faixa,\n'
      + 'que é exatamente quem ela existe para atender. A pergunta da entrada é\n'
      + '`podeInstalar()`. Nada quebra se alguém trocar: a tela funciona e a\n'
      + 'volta fecha em silêncio.',
    ).toBe(false);
  });

  it('cada plataforma recebe a receita DELA', () => {
    const casos = [
      ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', RECEITAS.ios],
      ['Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15', RECEITAS.ios],
      ['Mozilla/5.0 (Linux; Android 14; moto g84 5G) Chrome/131.0.0.0 Mobile', RECEITAS.android],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0', RECEITAS.computador],
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131.0.0.0', RECEITAS.computador],
      ['Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0.0.0', RECEITAS.computador],
    ];

    for (const [ua, esperada] of casos) {
      expect(
        receitaDeInstalacao(ua),
        `o \`userAgent\` abaixo recebeu a receita errada:\n  ${ua}\n`
        + 'Passo de outra plataforma manda a pessoa procurar um botão que não\n'
        + 'existe — e aí ela conclui que o site está quebrado, não que o texto\n'
        + 'está errado.',
      ).toBe(esperada);
    }
  });

  it('o ANDROID não cai na receita de computador — a ordem importa', () => {
    // O `userAgent` do Android contém "Linux", e `Linux` é um dos sinais de
    // computador. Testar o Android DEPOIS do computador mandaria todo celular
    // procurar um ícone na barra de endereço que o Chrome móvel não tem.
    expect(
      receitaDeInstalacao('Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile'),
      'o Android passou a receber a receita de computador.\n'
      + 'O `userAgent` dele contém "Linux": a checagem de Android TEM de vir\n'
      + 'antes da de computador.',
    ).toBe(RECEITAS.android);
  });

  it('o desconhecido tem RECEITA, não palpite', () => {
    const r = receitaDeInstalacao('AlgumNavegadorQueAindaNaoExiste/1.0');

    expect(
      r,
      'o `userAgent` desconhecido deixou de cair na receita genérica.\n'
      + 'Cair na de outra plataforma é o fallback silencioso do §4 vestido de\n'
      + 'ajuda: a pessoa segue um passo a passo que não serve para ela.',
    ).toBe(RECEITAS.desconhecido);

    expect(
      r.passos.join(' ').toLowerCase().includes('compartilhar'),
      'a receita genérica passou a mandar tocar em "Compartilhar".\n'
      + 'Esse é o caminho do iOS. A receita genérica existe justamente para\n'
      + 'NÃO afirmar onde a opção está — ela diz o que procurar.',
    ).toBe(false);
  });

  it('nenhuma receita é uma casca vazia', () => {
    for (const [chave, receita] of Object.entries(RECEITAS)) {
      expect(receita.titulo?.length > 0, `a receita \`${chave}\` ficou sem título.`).toBe(true);
      expect(
        receita.passos?.length >= 2,
        `a receita \`${chave}\` ficou com menos de 2 passos.\n`
        + 'Painel que abre com uma linha vaga é o "nada" de volta, só que com\n'
        + 'mais cliques para chegar nele.',
      ).toBe(true);
    }
  });

  it('o painel diz o que fazer para quem JÁ instalou', () => {
    // Quem instalou e abriu numa aba comum não recebe convite nenhum: o
    // navegador não oferece de novo. Sem esta frase, a pessoa lê um passo a
    // passo que "não funciona" e conclui que o site está quebrado.
    expect(
      /já instalou/i.test(readFileSync(PAINEL, 'utf8')),
      'o painel deixou de explicar o caso de quem já instalou.\n'
      + 'Para ela o navegador nunca mais oferece, então o passo a passo parece\n'
      + 'não funcionar — e o diagnóstico dela vira "o site está quebrado".',
    ).toBe(true);
  });
});
