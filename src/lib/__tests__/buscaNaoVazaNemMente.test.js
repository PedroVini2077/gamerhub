import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS_DA_BUSCA, ABAS_DA_BUSCA, abaValida } from '../areasDaBusca';

/**
 * `[24/09]` A busca — as três coisas que quebram em SILÊNCIO.
 *
 * ── 1. `buscar_posts` virar `SECURITY DEFINER` ────────────────────────────
 *
 * A mais grave, e a que mais parece inofensiva. Sob `INVOKER`, a RLS de
 * `posts` esconde apagado e oculto de quem não é equipe — **provado em
 * ROLLBACK**: com papel `authenticated` real, buscar o termo de um post
 * ocultado devolveu **0**; como `postgres`, devolveu 1.
 *
 * Sob `DEFINER` a função roda como o dono dela e a RLS deixa de valer: a busca
 * vira uma porta para ler conteúdo que a moderação tirou do ar. Nada estoura —
 * a lista só fica maior.
 *
 * ── 2. `buscar_pessoas` devolver coluna demais ────────────────────────────
 *
 * Essa **precisa** ser `DEFINER`: as colunas pessoais de `profiles` foram
 * revogadas de `authenticated` na SEC-025, então o cliente não lê a tabela
 * direto. Quando a função passa por cima da RLS, a defesa deixa de ser a
 * policy e passa a ser o **RECORTE** — e recorte é uma lista que alguém pode
 * ampliar sem perceber o que está fazendo.
 *
 * `email`, `suspended_until`, `banned` ou qualquer coluna pessoal ali vaza
 * para qualquer pessoa logada que digite uma letra na busca.
 *
 * ── 3. Aba que não busca nada ─────────────────────────────────────────────
 *
 * Somar "Notícias" à lista antes de existir busca de notícia produz uma aba
 * que devolve vazio — e quem usa lê vazio como "não achei nada", não como
 * "isto ainda não existe" (§1.5).
 *
 * ── Provada reinjetando (§2) ──────────────────────────────────────────────
 *
 *   . `buscar_posts` virando DEFINER        -> falhou nomeando a RLS
 *   . `email` somado ao RETURNS de pessoas  -> falhou nomeando a coluna
 *   . aba nova sem área correspondente      -> falhou nomeando a aba
 */

const MIGRATIONS = 'supabase/migrations';

function migracaoDaBusca() {
  const arquivo = readdirSync(MIGRATIONS)
    .filter((n) => n.includes('busca_rpcs'))
    .sort()
    .pop();
  if (!arquivo) {
    throw new Error(
      `Não achei a migration das RPCs de busca em ${MIGRATIONS}.\n`
      + '  Sem ela esta trava não olha nada e fica verde para sempre.');
  }
  return readFileSync(join(MIGRATIONS, arquivo), 'utf8');
}

const sql = migracaoDaBusca();
/** A prosa explica por que uma é INVOKER e a outra DEFINER — e as citaria. */
const semProsa = sql.replace(/^\s*--.*$/gm, '');

/** O corpo de uma das duas funções, para olhar cada uma por si. */
function corpoDa(nome) {
  const i = semProsa.indexOf(`FUNCTION public.${nome}(`);
  expect(i, `não achei \`${nome}\` na migration — ela mudou de nome?`).toBeGreaterThan(-1);
  const fim = semProsa.indexOf('$$;', i);
  return semProsa.slice(i, fim);
}

describe('a busca de posts não passa por cima da RLS', () => {
  it('`buscar_posts` é SECURITY INVOKER', () => {
    expect(corpoDa('buscar_posts'), [
      '`buscar_posts` deixou de ser `SECURITY INVOKER`.',
      '',
      'Sob INVOKER a RLS de `posts` esconde apagado e oculto sozinha — provado',
      'em ROLLBACK: usuário comum buscando o termo de um post ocultado recebeu',
      'ZERO; como postgres, 1.',
      '',
      'Sob DEFINER a busca vira porta para ler o que a moderação tirou do ar.',
      'Nada estoura: a lista só fica maior.',
    ].join('\n')).toMatch(/SECURITY\s+INVOKER/i);
  });

  it('as duas funções fecham para `anon` e têm `search_path`', () => {
    for (const nome of ['buscar_posts', 'buscar_pessoas']) {
      expect(semProsa, `\`${nome}\` perdeu o REVOKE de anon (régua de papéis de 12/09)`)
        .toMatch(new RegExp(`REVOKE[^;]*${nome}[^;]*anon`, 'i'));
      expect(corpoDa(nome), `\`${nome}\` está sem \`SET search_path\``)
        .toMatch(/SET\s+search_path\s*=\s*public/i);
    }
  });
});

describe('a busca de pessoas devolve o RECORTE, e só ele', () => {
  // A defesa de uma função DEFINER é o que ela escolhe devolver.
  const PERMITIDAS = ['id', 'username', 'avatar_url', 'role'];

  it('o RETURNS não ganhou coluna nova', () => {
    const corpo = corpoDa('buscar_pessoas');
    const returns = corpo.match(/RETURNS\s+TABLE\s*\(([^)]*)\)/i)?.[1];
    expect(returns, 'não achei o RETURNS TABLE de `buscar_pessoas`').toBeTruthy();

    const colunas = returns.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean);
    const extras = colunas.filter((c) => !PERMITIDAS.includes(c));

    expect(extras, [
      `\`buscar_pessoas\` passou a devolver: ${extras.join(', ')}`,
      '',
      'Ela é `SECURITY DEFINER` porque as colunas pessoais de `profiles` são',
      'revogadas de `authenticated` (SEC-025). Quando a função passa por cima',
      'da RLS, a defesa DEIXA de ser a policy e passa a ser este recorte.',
      '',
      'Coluna nova aqui vaza para qualquer pessoa logada que digite uma letra',
      'na busca. Se a nova for mesmo pública, some à lista PERMITIDAS deste',
      'teste — e explique por que ela é pública.',
    ].join('\n')).toEqual([]);
  });

  it('banido não aparece na busca', () => {
    expect(corpoDa('buscar_pessoas'), [
      '`buscar_pessoas` parou de excluir conta banida.',
      '',
      'Quem foi removido do site não volta por uma caixa de texto.',
    ].join('\n')).toMatch(/banned\s*=\s*false/i);
  });
});

describe('as abas da busca correspondem a áreas que existem', () => {
  it('toda aba, fora "Tudo", é uma área de verdade', () => {
    const semTudo = ABAS_DA_BUSCA.filter((a) => a.id !== 'tudo').map((a) => a.id);
    const areas = AREAS_DA_BUSCA.map((a) => a.id);
    const prometidas = semTudo.filter((id) => !areas.includes(id));

    expect(prometidas, [
      `As abas ${prometidas.join(', ')} não têm área correspondente.`,
      '',
      'Aba que não busca nada devolve vazio — e quem usa lê vazio como "não',
      'achei nada", não como "isto ainda não existe". A aba entra JUNTO com o',
      'que ela busca.',
    ].join('\n')).toEqual([]);
  });

  it('a lista não está vazia e "Tudo" vem na frente', () => {
    expect(AREAS_DA_BUSCA.length).toBeGreaterThanOrEqual(2);
    expect(ABAS_DA_BUSCA[0].id).toBe('tudo');
  });

  it('aba desconhecida vinda da URL é recusada', () => {
    // A query string é entrada de usuário: `?aba=<script>` não pode virar aba.
    expect(abaValida('posts')).toBe(true);
    expect(abaValida('noticias')).toBe(false);
    expect(abaValida('')).toBe(false);
  });
});
