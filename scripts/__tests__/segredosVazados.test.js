/**
 * O portão de segredos vazados — os dois lados dele.
 *
 * ── Por que este teste existe ───────────────────────────────────────────────
 *
 * Em 05/09 o portão reprovou o `CampoDeSenha.jsx` por causa de
 *
 *     aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
 *
 * O padrão lia `senha' : '` como "chave, dois-pontos, valor". Mas aquilo é um
 * TERNÁRIO: a aspa fecha um texto e o `:` é do `?:`. Falso positivo.
 *
 * Havia duas saídas, e uma delas era ruim: pôr o arquivo na lista de
 * dispensados cegaria o portão para uma senha de verdade escrita ali dentro,
 * **para sempre**. A outra — apertar o padrão — é a certa, e é a que tem um
 * risco próprio: apertar demais, e o portão para de pegar o que deveria.
 *
 * Este teste é o que impede as duas coisas. Ele não confere que o portão
 * "roda": confere **o que ele pega e o que ele deixa passar**.
 *
 * ── O detalhe que ninguém adivinha lendo o regex ────────────────────────────
 *
 * A precisão vem de uma REFERÊNCIA DE VOLTA (`\1`): a aspa antes da palavra e a
 * aspa depois têm que ser a mesma. Numa chave (`"password":`) elas estão
 * equilibradas; num ternário (`... senha' :`) a aspa aparece só depois.
 *
 * É sutil o bastante para alguém "simplificar" um dia sem perceber que está
 * devolvendo o falso positivo — ou, pior, abrindo o furo.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ARQUIVO = 'scripts/segredos-vazados.mjs';

/** Lê o padrão de senha do próprio portão, em vez de copiá-lo aqui. */
function padraoDeSenha() {
  const fonte = readFileSync(ARQUIVO, 'utf8');
  const bloco = fonte.slice(fonte.indexOf("nome: 'senha em texto no código'"));
  const linha = /re:\s*(\/.*\/[a-z]*),/.exec(bloco);

  // Copiar o regex para cá criaria duas fontes de verdade (§4): eu apertaria
  // uma e a outra continuaria frouxa, com o teste verde.
  expect(linha, `${ARQUIVO}: não achei o \`re:\` da regra de senha — ela mudou de forma?`)
    .not.toBeNull();

  const corpo = linha[1].lastIndexOf('/');
  return new RegExp(linha[1].slice(1, corpo), linha[1].slice(corpo + 1));
}

const DEVE_PEGAR = [
  ['atribuição com dois-pontos', 'password: "sup3rS3cr3t!"'],
  ['atribuição com igual', "senha = 'minhasenha123'"],
  ['chave entre aspas, como em JSON', '"password": "abcdefgh12"'],
  ['maiúsculas, como variável de ambiente', 'PASSWD="umasenhaqualquer"'],
  ['espaço sobrando depois do dois-pontos', 'passwd:   "outra_senha_9"'],
];

const NAO_PODE_PEGAR = [
  ['o ternário do olho de mostrar senha', "visivel ? 'Ocultar senha' : 'Mostrar senha'"],
  ['ternário em inglês', "x ? 'no password' : 'tem password aqui'"],
  ['valor que vem de variável', 'password: senhaDoUsuario'],
  ['valor interpolado', 'password: `${senhaDigitada}`'],
];

describe('o portão de segredos — senha em texto', () => {
  it.each(DEVE_PEGAR)('pega: %s', (_nome, texto) => {
    expect(
      padraoDeSenha().test(texto),
      `o portao DEIXOU PASSAR uma senha em texto: ${texto}\n`
      + 'Apertar o padrao para matar falso positivo nao pode custar o que ele\n'
      + 'existe para pegar. O repositorio e PUBLICO.',
    ).toBe(true);
  });

  it.each(NAO_PODE_PEGAR)('deixa passar: %s', (_nome, texto) => {
    expect(
      padraoDeSenha().test(texto),
      `o portao ACUSOU um falso positivo: ${texto}\n`
      + 'Portao que grita a toa vira ruido, e ruido ensina a ignorar o canal\n'
      + '(§0.2, quarta regra) — que e onde a senha de verdade vai aparecer.',
    ).toBe(false);
  });

  it('a lista de dispensados não cresceu sem motivo escrito', () => {
    const fonte = readFileSync(ARQUIVO, 'utf8');
    const bloco = /const DISPENSADOS = new Set\(\[([\s\S]*?)\]\)/.exec(fonte);
    expect(bloco, `${ARQUIVO}: não achei a lista DISPENSADOS`).not.toBeNull();

    const entradas = [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

    // Dispensar arquivo é cegar o portão para ele PARA SEMPRE. As três
    // entradas legítimas, cada uma explicada no código: o próprio portão (que
    // contém os padrões que procura), o e2e que manda assinatura falsa de
    // propósito, e ESTE arquivo — que precisa de senhas em texto para conferir
    // que o padrão ainda pega o que deve pegar. Uma quarta precisa de conversa,
    // não de commit silencioso.
    expect(
      entradas.sort(),
      'alguem dispensou mais um arquivo do portao de segredos.\n'
      + 'Dispensar CEGA o portao para aquele arquivo, para sempre — inclusive\n'
      + 'para uma senha de verdade escrita nele depois. Quase sempre o certo e\n'
      + 'apertar o PADRAO, nao esconder o arquivo. Se for mesmo necessario,\n'
      + 'atualize este teste junto, com o motivo.',
    ).toEqual([
      'e2e/portas-fechadas.mjs',
      'scripts/__tests__/segredosVazados.test.js',
      'scripts/segredos-vazados.mjs',
    ]);
  });
});
