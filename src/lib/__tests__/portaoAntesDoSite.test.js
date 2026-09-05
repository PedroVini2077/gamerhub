/**
 * TRAVA: o portão de boas-vindas tem que cobrir a tela ANTES de o site pintar.
 *
 * ── O bug que ela impede de voltar ──────────────────────────────────────────
 *
 * Relato do dono em 05/09: *"assim que eu logava, eu via o site por alguns
 * segundos, depois aparecia o portão, no caso o site só deve aparecer depois do
 * portão"*.
 *
 * A causa era uma ordem, não um cálculo — por isso não havia número errado para
 * um teste comum pegar:
 *
 *     signInWithPassword ... o onAuthStateChange preenche o `user` AQUI dentro,
 *                            antes de a promessa voltar
 *     -> o App troca de rota e o site PINTA
 *     get_own_profile ...... mais uma ida ao servidor
 *     logAudit ............. mais uma
 *     marcarEntradaAgora ... só agora o portão fica sabendo
 *
 * O conserto tem duas metades, e **as duas são invisíveis em runtime**: quem
 * desfizer qualquer uma delas não vê erro nenhum, não quebra nenhum teste de
 * comportamento, e o site volta a piscar — que é exatamente o desenho de falha
 * silenciosa do §1.5. Daí a trava ser de CONTRATO, lendo o código-fonte.
 *
 * ── Por que ler o fonte, e não simular ──────────────────────────────────────
 *
 * Porque o que precisa ser garantido é *quando* cada coisa acontece em relação
 * à PINTURA do navegador, e jsdom não pinta. Um teste de comportamento com
 * `render()` passaria com `useEffect` e com `useLayoutEffect` igualmente — ele
 * não sabe a diferença, que é justamente a diferença que importa.
 *
 * ── Provada reinjetando o bug (§2) ──────────────────────────────────────────
 *
 * Não basta o teste existir. Com `useLayoutEffect` trocado de volta por
 * `useEffect`, ele falha apontando o arquivo e dizendo o que fazer; com a
 * chamada de `marcarEntradaAgora()` movida para depois do `signInWithPassword`,
 * idem. Sem esse par de conferências, isto seria decoração.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const AUTH = 'src/hooks/useAuth.jsx';
const PORTAO = 'src/components/auth/PortaoDeBoasVindas.jsx';

const ler = (caminho) => {
  const texto = readFileSync(caminho, 'utf8');
  // A guarda do `varrerFontes`: arquivo renomeado não pode deixar a trava
  // verde para sempre. Aqui `readFileSync` já estoura se sumir, mas um arquivo
  // esvaziado passaria — e passar em silêncio é o que esta trava existe para
  // impedir.
  if (texto.length < 400) {
    throw new Error(`${caminho} está vazio ou minúsculo — a trava não leu nada.`);
  }
  return texto;
};

/** Remove comentários, para "a palavra aparece no comentário" não valer como código. */
const semComentarios = (texto) => texto
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('o portão sobe antes de o site pintar', () => {
  it('marca a entrada ANTES de pedir o login ao servidor', () => {
    const codigo = semComentarios(ler(AUTH));

    const marca = codigo.indexOf('marcarEntradaAgora()');
    const login = codigo.indexOf('signInWithPassword');

    expect(marca, `${AUTH}: não achei a chamada de marcarEntradaAgora().`)
      .toBeGreaterThan(-1);
    expect(login, `${AUTH}: não achei a chamada de signInWithPassword.`)
      .toBeGreaterThan(-1);

    expect(
      marca,
      `${AUTH}: marcarEntradaAgora() está DEPOIS de signInWithPassword.\n`
      + 'O onAuthStateChange preenche o `user` dentro dessa chamada, então o\n'
      + 'site troca de rota e pinta antes de a marca existir — e o portão sobe\n'
      + 'atrasado, que é o defeito relatado em 05/09. Mova a marca para antes.',
    ).toBeLessThan(login);
  });

  it('desfaz a marca em todo caminho que NÃO termina em entrada', () => {
    const codigo = semComentarios(ler(AUTH));
    const quantos = codigo.split('cancelarEntradaAgora()').length - 1;

    expect(
      quantos,
      `${AUTH}: a marca é escrita antes do login, então TODO caminho que não\n`
      + 'termina em entrada precisa desfazê-la. Hoje são dois: login recusado e\n'
      + 'conta banida. Achei ' + quantos + ' chamada(s) de cancelarEntradaAgora().\n'
      + 'Marca que sobra abre um portão sem causa no próximo `user` da aba.',
    ).toBeGreaterThanOrEqual(2);
  });

  it('lê o armazenamento em useLayoutEffect, que roda antes da pintura', () => {
    const codigo = semComentarios(ler(PORTAO));

    // O efeito que consome a marca é o que decide o instante em que o portão
    // aparece. Ele precisa ser de LAYOUT: `useEffect` roda depois da pintura, e
    // aí existe pelo menos um quadro com o site à mostra e nada por cima.
    // O último hook de efeito ABERTO antes do consumo é o dono daquele trecho.
    // Procurar `use...(` e não a palavra solta: `useAuth.jsx` no caminho do
    // import também contém "use", e foi nisso que a primeira versão desta trava
    // tropeçou. E `consumirEntradaAgora()` COM parênteses, senão o alvo vira a
    // linha do `import`, que vem antes de qualquer hook.
    const trecho = codigo.slice(0, codigo.indexOf('consumirEntradaAgora()'));
    const hooks = trecho.match(/use(?:Layout)?Effect\s*\(/g) || [];
    const hook = (hooks.at(-1) || 'nenhum(').split(/\s*\(/)[0];

    expect(
      hook,
      `${PORTAO}: quem consome a marca é o \`${hook}\`, e precisa ser\n`
      + '`useLayoutEffect`. `useEffect` roda DEPOIS de o navegador pintar, então\n'
      + 'sobra um quadro com o site logado visível e o portão ainda por vir —\n'
      + 'o defeito que o dono relatou em 05/09.',
    ).toBe('useLayoutEffect');
  });

  it('não adia a abertura com temporizador', () => {
    const codigo = semComentarios(ler(PORTAO));
    const posVisivel = codigo.indexOf('setVisivel(true)');
    const janela = codigo.slice(Math.max(0, posVisivel - 260), posVisivel);

    expect(
      janela.includes('setTimeout'),
      `${PORTAO}: setVisivel(true) está dentro de um setTimeout.\n`
      + 'Qualquer adiamento aqui devolve o bug: o portão passa a subir num\n'
      + 'quadro posterior ao do site. Chame direto, dentro do useLayoutEffect.',
    ).toBe(false);
  });
});
