/**
 * Publicar um post e esperar ele aparecer no feed — passo compartilhado.
 *
 * ── Por que virou arquivo ───────────────────────────────────────────────────
 *
 * `fluxos.mjs` e `painel-admin.mjs` tinham a MESMA sequência copiada: preencher,
 * clicar em Publicar, esperar o `h2`. Duas cópias da mesma coisa divergem (§4),
 * e aqui a divergência custaria caro — as duas precisam da melhoria abaixo.
 *
 * ── O que ele conserta, e é a razão de existir ──────────────────────────────
 *
 * Em 02/09 o job do painel falhou assim:
 *
 *     FALHOU em: painel de admin
 *     - waiting for locator('h2').filter({ hasText: '[painel 1788347076199]' })
 *
 * Isso diz **o que não aconteceu** e nada sobre **por quê**. Fui ao banco e o
 * post não existia — ou seja, o `INSERT` nem chegou a acontecer. E o site
 * tinha dito o motivo, num toast, que o teste jogou fora.
 *
 * A mensagem de erro tem que ENSINAR (§2). Este helper vigia os avisos da tela
 * enquanto espera e os devolve na falha, com o que cada um significa.
 */

/**
 * @param {import('playwright').Page} page
 * @param {object} opcoes
 * @param {string} opcoes.titulo   o que vai no campo de título
 * @param {string} opcoes.corpo    o que vai no campo de conteúdo
 * @param {string} opcoes.marca    o trecho único que identifica ESTE post
 * @param {number} [opcoes.timeout]
 * @returns {Promise<import('playwright').Locator>} o `h2` do post no feed
 */
export async function publicarEEsperarNoFeed(page, {
  titulo, corpo, marca, timeout = 30000,
}) {
  // Todos os avisos que a tela deu, sem classificar. O `react-hot-toast` usa
  // `role="status"` tanto no sucesso quanto no erro, e tentar separar os dois
  // por texto seria adivinhação — o valor está em relatar o que apareceu.
  const avisos = new Set();
  const coletarAvisos = async () => {
    const textos = await page.locator('[role="status"]').allInnerTexts().catch(() => []);
    for (const t of textos) {
      const limpo = t.trim();
      if (limpo) avisos.add(limpo);
    }
  };

  await page.locator('#post-title').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#post-title').fill(titulo);
  await page.locator('#post-content').fill(corpo);
  await page.getByRole('button', { name: /^Publicar$/ }).click();

  const alvo = page.locator('h2', { hasText: marca }).first();
  const limite = Date.now() + timeout;

  // Laço de 500 ms em vez de `waitFor`: o `waitFor` bloqueia até estourar e não
  // deixa ninguém olhar a tela no meio do caminho — que é exatamente onde o
  // toast aparece e some.
  while (Date.now() < limite) {
    await coletarAvisos();
    if (await alvo.isVisible().catch(() => false)) return alvo;
    await page.waitForTimeout(500);
  }
  await coletarAvisos();

  const ditos = avisos.size
    ? [...avisos].map(t => JSON.stringify(t)).join(' | ')
    : '(a tela nao disse NADA)';

  throw new Error(
    `o post "${marca}" nao apareceu no feed em ${timeout / 1000}s.\n`
    + `  O que a tela disse enquanto isso: ${ditos}\n`
    + '\n'
    + '  Como ler isso:\n'
    + '    "Conteudo nao permitido"  -> a wordlist casou algo no titulo ou no corpo.\n'
    + '    "Erro: ..."               -> o INSERT falhou, e a mensagem vem do banco\n'
    + '                                 (RLS, trigger, constraint).\n'
    + '    "Post publicado!"         -> o post EXISTE e o feed nao releu. Aqui o\n'
    + '                                 suspeito e `lib/recarregarAteAparecer.js`:\n'
    + '                                 leitura logo apos escrita pode trazer dado\n'
    + '                                 anterior, e a insistencia dele tem teto.\n'
    + '    (nada)                    -> o clique nao chegou no botao, ou a pagina\n'
    + '                                 nao era o feed. Veja a evidencia salva.');
}

/**
 * Os prefixos que marcam post criado por TESTE — fonte única.
 *
 * ── Por que isto virou constante compartilhada ──────────────────────────────
 *
 * `[11/09]` Um post `[painel ...]` ficou **visível no site** desde 10/09, e o
 * detector de sobras existia. Ele só não olhava para aquele prefixo: procurava
 * `[e2e ` e nada mais, enquanto o `painel-admin.mjs` publica com `[painel `.
 *
 * É varredura de CASO, não de classe (§1.3) — e a lista escrita à mão num
 * lugar só ia divergir do dia em que o segundo prefixo nasceu. Divergiu.
 *
 * Quem publicar com um prefixo novo acrescenta aqui, e o detector passa a
 * enxergar sozinho.
 */
export const PREFIXOS_DE_TESTE = ['[e2e ', '[painel '];

/** A marca desta execução: prefixo + relógio, para não colidir entre rodadas. */
export function marcaDeTeste(prefixo) {
  if (!PREFIXOS_DE_TESTE.includes(prefixo)) {
    throw new Error(
      `Prefixo de teste "${prefixo}" nao esta em PREFIXOS_DE_TESTE, em `
      + 'e2e/publicarPost.mjs. Sem ele na lista, o detector de sobras NAO ve o '
      + 'post desta marca — e um post de teste fica no ar sem ninguem saber.');
  }
  return `${prefixo}${Date.now()}]`;
}

/** Um seletor que casa QUALQUER marca de teste, para o detector de sobras. */
export const REGEX_DE_SOBRA = new RegExp(
  PREFIXOS_DE_TESTE.map((p) => p.replace(/[[\]]/g, '\\$&')).join('|'),
);

/**
 * Há quanto tempo uma marca precisa existir para ser considerada SOBRA.
 *
 * ── O alarme falso que este número apaga ────────────────────────────────────
 *
 * `[11/09]` O detector nasceu enxergando os dois prefixos — que era o conserto
 * certo, porque ver só `[e2e ` deixou um post do painel no ar desde 10/09. Só
 * que os jobs `fluxos autenticados` e `painel de admin` rodam **em paralelo**,
 * contra o MESMO banco de produção. O primeiro PR com o detector novo reprovou
 * na hora: o `fluxos` viu `[painel 1789128844574]` no feed e chamou de sobra o
 * post que o outro job estava usando **naquele segundo**.
 *
 * É o alarme que grita à toa (§0.2, 4ª regra), e eu mesmo o criei — de novo.
 *
 * ── Por que IDADE, e não "cada um olha só o seu prefixo" ────────────────────
 *
 * Essa era a saída fácil, e ela devolve o buraco original: com cada roteiro
 * vigiando só o próprio prefixo, ninguém vigia o prefixo de um roteiro que
 * morreu antes de chegar na conferência — que é exatamente o caso que deixa
 * lixo no ar.
 *
 * A marca carrega o relógio (`marcaDeTeste`), então a pergunta certa tem
 * resposta: **este post é de uma rodada que já devia ter terminado?** Uma
 * execução inteira leva ~1 minuto; 30 é folga de sobra para qualquer job
 * concorrente, e ainda pega a sobra na rodada seguinte.
 */
export const IDADE_DE_SOBRA_MS = 30 * 60 * 1000;

/**
 * Dos títulos na tela, quais são sobra de uma rodada ANTIGA.
 *
 * Título sem relógio legível **conta como sobra**: a marca é gerada por
 * `marcaDeTeste`, que sempre põe o número — então um `[e2e ` sem ele é lixo de
 * outra origem, e engolir o desconhecido seria o fallback silencioso do §4.
 */
export function sobrasAntigas(titulos, agora = Date.now()) {
  return titulos.filter((t) => {
    if (!REGEX_DE_SOBRA.test(t)) return false;
    const m = t.match(/\[(?:e2e|painel) (\d+)\]/);
    if (!m) return true;
    return agora - Number(m[1]) > IDADE_DE_SOBRA_MS;
  });
}
