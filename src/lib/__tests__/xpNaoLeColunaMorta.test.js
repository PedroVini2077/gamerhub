/**
 * TRAVA: nada pode voltar a contar curtidas de `posts.likes`.
 *
 * ── O bug ───────────────────────────────────────────────────────────────────
 *
 * `posts.likes` existe e **nenhum trigger a mantém**. O único trigger em
 * `post_likes` é o `notify_post_like`, que só insere notificação. Quem somasse
 * aquela coluna recebia 0 para todo mundo, para sempre.
 *
 * Comprovado em transação com ROLLBACK em 05/09: 3 linhas inseridas em
 * `post_likes`, `posts.likes` = 0, `get_user_xp` = 0.
 *
 * ── Por que ele escapou, que é o que esta trava realmente ataca ─────────────
 *
 * O `get_user_xp` era o **terceiro** lugar com o mesmo defeito. Os outros dois
 * — `fetchProfileStats` no frontend e `owner_get_metrics` no banco — já tinham
 * sido corrigidos antes, **cada um por conta própria**. Ninguém perguntou "onde
 * mais este padrão existe?" (§1.3, varredura de classe), e o que sobrou ficou
 * errado sozinho por meses.
 *
 * Então a trava não vigia uma função: vigia o PADRÃO, nos dois territórios onde
 * ele pode reaparecer — o JavaScript e as migrations.
 *
 * ── Por que ela lê arquivo em vez de consultar o banco ──────────────────────
 *
 * Porque o `npm test` roda sem credencial de banco, e uma trava que só funciona
 * com segredo configurado é uma trava que não roda no lugar mais importante: a
 * máquina de quem está escrevendo o código. A pasta `supabase/migrations` é,
 * por decisão registrada no README dela, **a verdade sobre o schema** — então
 * ler dali é ler a fonte, não um espelho.
 *
 * O buraco que sobra, dito com todas as letras: um `CREATE OR REPLACE` aplicado
 * direto no Supabase, sem passar pelo repositório, escapa desta trava. É o
 * mesmo buraco que o README das migrations já descreve, e a resposta dele é a
 * mesma — migration que não está aqui não existe.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { varrerFontes } from './varrerFontes';

/**
 * O padrão proibido: somar/agregar a coluna morta.
 *
 * Deliberadamente estreito. `posts.likes` aparece legitimamente em `SELECT` de
 * compatibilidade e em comentários que explicam por que ela não presta — barrar
 * a menção inteira transformaria a trava em ruído, e ruído ensina a ignorar o
 * canal (§0.2, quarta regra). O que não pode é **contar** com ela.
 */
const SOMA_A_COLUNA_MORTA = /(?:sum|coalesce\s*\(\s*sum)\s*\(\s*(?:po?\.)?likes\s*\)/i;

describe('ninguém soma a coluna morta posts.likes', () => {
  it('nas migrations — a pasta que é a verdade sobre o schema', () => {
    const dir = 'supabase/migrations';
    const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql'));

    // A guarda do `varrerFontes`, aplicada à mão porque aqui são `.sql`:
    // pasta renomeada deixaria a lista vazia e o teste verde para sempre.
    expect(arquivos.length, `${dir} não tem migration nenhuma — a trava não leu nada.`)
      .toBeGreaterThan(100);

    // A ÚLTIMA definição de cada função é a que vale: migrations antigas
    // guardam o erro de propósito, é o histórico. Só a mais recente é o estado.
    const definidoras = arquivos
      .filter((f) => /get_user_xp|owner_get_metrics/.test(readFileSync(`${dir}/${f}`, 'utf8')))
      .sort();

    expect(definidoras.length, 'nenhuma migration define get_user_xp — nome mudou?')
      .toBeGreaterThan(0);

    const ultima = definidoras.at(-1);
    const sql = readFileSync(`${dir}/${ultima}`, 'utf8');

    expect(
      SOMA_A_COLUNA_MORTA.test(sql),
      `${dir}/${ultima}: esta migration soma \`posts.likes\`.\n`
      + 'Essa coluna NUNCA e mantida por trigger nenhum — a soma da 0 para todo\n'
      + 'mundo, para sempre, e nada estoura. Conte de `post_likes`:\n'
      + '  SELECT COUNT(*) FROM post_likes pl JOIN posts p ON p.id = pl.post_id\n'
      + '   WHERE p.user_id = <alvo> AND pl.user_id <> p.user_id;\n'
      + 'O `<>` exclui a auto-curtida, senão curtir o proprio post vira XP.',
    ).toBe(false);
  });

  it('no JavaScript — onde o mesmo padrão já apareceu uma vez', () => {
    // `varrerFontes` devolve CAMINHOS, e já estoura sozinho se a pasta sumir.
    const infratores = varrerFontes('src').filter((caminho) => {
      const conteudo = readFileSync(caminho, 'utf8');
      // Sem comentários: o `profileService.js` EXPLICA o bug num comentário, e
      // explicar não é cometer.
      const codigo = conteudo
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      // O caso real que existiu: somar `p.likes` reduzindo a lista de posts.
      return /\.reduce\([^)]*\)\s*=>[^;]*\.likes/.test(codigo)
        || /sum\s*\(\s*likes\s*\)/i.test(codigo);
    });

    expect(
      infratores,
      'algum arquivo voltou a somar `posts.likes` no JavaScript.\n'
      + 'Ela nunca e mantida: o total sai 0 e ninguem percebe. Conte de\n'
      + '`post_likes` — `fetchProfileStats` em services/profileService.js ja\n'
      + 'faz isso e serve de modelo.',
    ).toEqual([]);
  });
});
