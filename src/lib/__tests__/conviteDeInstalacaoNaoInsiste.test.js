import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * `[08/10]` O CONVITE PARA INSTALAR — as quatro formas de ele falhar calado.
 *
 * ── 1. O ouvinte chega TARDE ───────────────────────────────────────────────
 *
 * `beforeinstallprompt` dispara uma vez e normalmente **antes do React
 * montar**. Registrado dentro de um componente, o ouvinte nunca vê o evento e
 * o convite simplesmente não aparece — sem erro, sem log, sem teste quebrado.
 * Por isso a captura é chamada do `main.jsx`, e esta trava exige que continue.
 *
 * ── 2. O convite INSISTE com quem disse não ────────────────────────────────
 *
 * É a mesma lição do som ambiente: *"dispensei"* e *"nunca vi"* são estados
 * diferentes, e colapsá-los na ausência de chave faz o convite voltar para
 * quem recusou. Site que insiste no que você recusou é site que não te escuta.
 *
 * ── 3. `prompt()` é chamado DUAS vezes ─────────────────────────────────────
 *
 * O navegador recusa a segunda chamada no mesmo evento. Um clique duplo faria
 * exatamente isso, e o segundo clique quebraria — por isso o evento é
 * descartado ANTES de ser usado.
 *
 * ── 4. O convite aparece para quem JÁ instalou ─────────────────────────────
 *
 * App aberto da gaveta roda em `standalone`. Convidar alguém a instalar o que
 * já está instalado é ruído puro.
 */

const LIB = 'src/lib/conviteDeInstalacao.js';

/** Um `localStorage` de mentira, porque o ambiente de teste não tem um. */
function comArmazenamento() {
  const dados = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
  });
  return dados;
}

/** Um evento de convite de mentira, que conta quantas vezes foi aberto. */
function conviteFalso(escolha = 'accepted') {
  const e = {
    abriu: 0,
    preventDefault() {},
    prompt() { e.abriu += 1; },
    userChoice: Promise.resolve({ outcome: escolha }),
  };
  return e;
}

/** Dispara o evento no `window` e devolve o módulo já com ele capturado. */
async function comEventoDisparado(evento, standalone = false) {
  const ouvintes = {};
  vi.stubGlobal('window', {
    addEventListener: (nome, f) => { ouvintes[nome] = f; },
    matchMedia: () => ({ matches: standalone }),
    navigator: {},
  });
  vi.resetModules();
  const mod = await import('../conviteDeInstalacao.js');
  mod.capturarConviteDeInstalacao();
  if (evento) ouvintes.beforeinstallprompt?.(evento);
  return { mod, ouvintes };
}

describe('o convite de instalação não insiste nem chega tarde', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    comArmazenamento();
  });

  it('a captura é chamada do `main.jsx`, não de um componente', () => {
    const main = readFileSync('src/main.jsx', 'utf8');
    expect(
      /capturarConviteDeInstalacao\(\)/.test(main),
      'a captura saiu do `main.jsx`.\n'
      + '`beforeinstallprompt` dispara UMA vez e normalmente antes do React\n'
      + 'montar. Um ouvinte dentro de componente chega tarde e nunca vê o\n'
      + 'evento: o convite não aparece, e nada acusa (§1.5).',
    ).toBe(true);
  });

  it('só convida quando o navegador ofereceu', async () => {
    const { mod } = await comEventoDisparado(null);
    expect(
      mod.devoConvidar(),
      'o convite apareceu sem o navegador ter oferecido.\n'
      + 'Sem o evento, o botão "Instalar" não tem o que abrir — ele clicaria\n'
      + 'e nada aconteceria.',
    ).toBe(false);
  });

  it('não convida quem JÁ instalou', async () => {
    const { mod } = await comEventoDisparado(conviteFalso(), true);
    expect(
      mod.devoConvidar(),
      'o convite apareceu dentro do app já instalado.\n'
      + 'Quem abriu da gaveta roda em `standalone` — convidá-la a instalar o\n'
      + 'que já está instalado é ruído puro.',
    ).toBe(false);
  });

  it('NÃO volta para quem dispensou', async () => {
    const { mod } = await comEventoDisparado(conviteFalso());
    expect(mod.devoConvidar(), 'o convite não apareceu quando devia.').toBe(true);

    mod.dispensarConvite();
    expect(mod.decisaoGuardada()).toBe('dispensou');

    // Nova visita: o navegador oferece de novo e a decisão tem de pesar.
    const outra = await comEventoDisparado(conviteFalso());
    expect(
      outra.mod.devoConvidar(),
      'o convite voltou para quem já tinha dispensado.\n'
      + '"Dispensei" e "nunca vi" são estados DIFERENTES — colapsá-los na\n'
      + 'ausência de chave é o que faz o site insistir. Mesma lição do som\n'
      + 'ambiente (`preferenciaDeSom.js`).',
    ).toBe(false);
  });

  it('`prompt()` nunca é chamado duas vezes', async () => {
    const evento = conviteFalso();
    const { mod } = await comEventoDisparado(evento);

    await Promise.all([mod.abrirConvite(), mod.abrirConvite()]);

    expect(
      evento.abriu,
      `\`prompt()\` foi chamado ${evento.abriu} vezes.\n`
      + 'O navegador recusa a segunda no mesmo evento, e um clique duplo faz\n'
      + 'exatamente isso. O evento tem de ser descartado ANTES de ser usado.',
    ).toBe(1);
  });

  it('instalar pelo menu do navegador também encerra o convite', async () => {
    const { mod, ouvintes } = await comEventoDisparado(conviteFalso());
    expect(mod.devoConvidar()).toBe(true);

    ouvintes.appinstalled?.();
    expect(
      mod.decisaoGuardada(),
      'instalar pelo menu do navegador deixou o convite de pé.\n'
      + 'A pessoa instalaria e continuaria vendo "Instalar o GamerHub" —\n'
      + 'o site afirmando algo que ele mesmo sabe ser falso.',
    ).toBe('instalou');
  });

  it('armazenamento bloqueado não derruba nada', async () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('bloqueado'); },
      setItem() { throw new Error('bloqueado'); },
    });
    const { mod } = await comEventoDisparado(conviteFalso());
    expect(
      () => mod.devoConvidar(),
      'aba anônima com armazenamento bloqueado passou a quebrar a tela.\n'
      + 'Não poder guardar uma preferência nunca pode derrubar o site.',
    ).not.toThrow();
  });

  it('o `preventDefault` continua lá — senão o navegador decide sozinho', () => {
    expect(
      /evento\.preventDefault\(\)/.test(readFileSync(LIB, 'utf8')),
      'o `preventDefault` sumiu.\n'
      + 'Sem ele o navegador mostra a barra DELE, onde ele quer e com o texto\n'
      + 'dele — e o nosso convite vira uma segunda barra em cima da primeira.',
    ).toBe(true);
  });
});
