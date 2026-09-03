import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Trava do cadastro — os dois bugs que ela impede JÁ ACONTECERAM.
 *
 * ── Bug 1: o `UPDATE` que nunca funcionou e nunca reclamou ──────────────────
 *
 * `signUpWithEmail` gravava `birth_date`, `state` e `platform` com um
 * `supabase.from('profiles').update(...)` logo depois do `signUp`. Com
 * confirmação de e-mail ligada o `signUp` **não devolve sessão**, então aquele
 * UPDATE rodava como `anon` — e a única policy de UPDATE de `profiles` é
 * `TO authenticated`.
 *
 * Medido em ROLLBACK: **0 linhas afetadas e nenhum erro**. O código checava
 * `error`, que vinha nulo, e seguia em frente.
 *
 * **A consequência era maior que os três campos.** `birth_date` nunca chegava
 * ao banco, e o `guard_idade_minima` dispara em `INSERT OR UPDATE OF
 * birth_date`. Sem o valor ele nunca disparava: a idade mínima de 13 anos
 * existia no formulário, no banco e na política de privacidade, e **não era
 * imposta em lugar nenhum**. Prova: 3 dos 5 perfis com `birth_date` nulo.
 *
 * ── Bug 2: o `select` que mantinha `profiles` aberto ao anônimo ─────────────
 *
 * A checagem de username duplicado fazia `select('id').eq('username', …)`, e
 * era o único motivo de `anon` ter `SELECT (id, username)`. O PostgREST não
 * obriga a filtrar: `select=id,username` devolvia todas as linhas.
 *
 * ── Por que varredura de fonte, e não teste de comportamento ────────────────
 *
 * Os dois bugs são sobre **qual chamada é feita**, e as duas versões erradas
 * rodam sem estourar — uma devolve 0 linhas em silêncio, a outra devolve dados
 * demais. Um teste de comportamento com mock passaria nas duas. O que precisa
 * ficar travado é a forma da chamada.
 */
describe('o cadastro não pode voltar a depender de profiles', () => {
  const fonte = readFileSync('src/services/cadastroService.js', 'utf8');

  /**
   * O CÓDIGO, sem comentário nenhum.
   *
   * Necessário porque este arquivo DESCREVE os dois bugs nos comentários — de
   * propósito, para quem ler entender por que a forma atual existe. Sem tirar
   * comentário, a trava acusaria a própria explicação do bug como se fosse o
   * bug de volta. (Aconteceu na primeira execução.)
   */
  const codigo = fonte
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  it('a fonte foi mesmo lida', () => {
    // Sem isto, mover `signUpWithEmail` para outro arquivo deixaria as três
    // travas abaixo verdes para sempre — elas passariam a varrer um arquivo
    // que não tem mais o código que elas vigiam. É a lição do `varrerFontes`:
    // trava que não leu nada é decoração.
    expect(fonte.length, 'cadastroService.js veio vazio').toBeGreaterThan(1000);
    expect(fonte,
      '`criarConta` nao esta mais em cadastroService.js. Se ele foi movido,\n'
      + '  aponte este teste para o arquivo novo — senao ele para de vigiar.\n'
      + '  (Esta trava pegou exatamente isso quando o cadastro saiu do\n'
      + '  useAuth.jsx em 03/09 — ela avisou, e por isso este arquivo mudou.)')
      .toContain('export async function criarConta');
  });

  it('checa username pela RPC, e não com select em profiles', () => {
    expect(fonte,
      'a checagem de username voltou a usar `select` em profiles.\n'
      + '  Isso obriga a devolver SELECT (id, username) para `anon`, e o\n'
      + '  PostgREST nao obriga a filtrar: `select=id,username` entrega a lista\n'
      + '  inteira de usuarios, com UUID e nome.\n'
      + '  Use a RPC `username_disponivel`, que responde a mesma pergunta.')
      .toContain("rpc('username_disponivel'");

    // A forma exata do bug antigo, para o teste falhar mesmo se alguém deixar
    // a RPC no lugar e ACRESCENTAR o select de volta.
    expect(codigo,
      'voltou um `.from(\'profiles\')` dentro do cadastro')
      .not.toMatch(/from\('profiles'\)[\s\S]{0,120}\.eq\('username'/);
  });

  it('os campos extras vão no metadata do signUp, e não num UPDATE depois', () => {
    expect(fonte,
      'os campos extras do cadastro precisam ir em `options.data` do signUp.\n'
      + '  Um UPDATE em profiles logo apos o signUp roda como `anon` (nao ha\n'
      + '  sessao ainda) e afeta 0 LINHAS, SEM ERRO — foi assim que birth_date\n'
      + '  nunca chegou ao banco e a idade minima de 13 anos deixou de ser\n'
      + '  imposta, enquanto a politica de privacidade dizia que era.')
      .toMatch(/options:\s*\{\s*data:\s*\{\s*username,\s*\.\.\.extras\s*\}/);

    expect(codigo,
      'voltou um UPDATE em profiles dentro do cadastro — ele afeta 0 linhas\n'
      + '  e nao devolve erro. Os campos vao no metadata.')
      .not.toMatch(/from\('profiles'\)\s*\.update/);
  });

  it('a regra de username do cliente é a MESMA que o banco aplica', () => {
    // Deriva de classe (§6 FASE 4): a RPC recusa fora de `^[a-z0-9_]{3,20}$`.
    // Se o cliente afrouxar, a pessoa digita um nome que o formulario aceita e
    // o banco recusa — com uma mensagem que ela nao tem como entender.
    const regex = fonte.match(/USERNAME_REGEX\s*=\s*(\/[^\n]+\/)/)?.[1];
    expect(regex,
      'nao achei USERNAME_REGEX em cadastroService.js — ele foi renomeado?').toBeTruthy();
    expect(regex,
      'a regra do cliente divergiu da que `username_disponivel` aplica no banco\n'
      + '  (^[a-z0-9_]{3,20}$). Mudar uma exige mudar a outra na mesma migration.')
      .toBe('/^[a-z0-9_]{3,20}$/');
  });
});
