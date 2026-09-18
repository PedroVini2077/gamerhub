import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[18/09]` SEC-025 — `authenticated` não escreve as colunas privilegiadas de
 * `profiles`, e essa porta não pode reabrir por descuido.
 *
 * ── O achado foi dele ──────────────────────────────────────────────────────
 *
 * Ele mandou `PATCH {"role":"user"}` na própria linha, pela Data API, e recebeu
 * **HTTP 204**. Depois desconfiou do próprio teste — *"não assuma que 204
 * significa que os campos foram modificados"* —, e estava certo nas duas
 * pontas: o comando **era** aceito, e o valor **não** mudava.
 *
 * ── O que a investigação mostrou ───────────────────────────────────────────
 *
 * `authenticated` tinha UPDATE nas **25** colunas. O que impedia o estrago era
 * **um trigger e só ele** (`trg_guard_profile_privileged`), que reverte as nove
 * colunas quando `current_user` é `authenticated`/`anon`.
 *
 * Não havia escalação — medido: o `role` gravado continuava `user`, e
 * `is_staff()`/`is_owner()` seguiam `false`. **O problema era a camada única.**
 * Desabilitado o trigger, renomeado, ou num caminho onde `current_user` não
 * fosse `authenticated`, a escalação abriria em silêncio.
 *
 * ── Por que a trava lê MIGRATION, e não o banco ────────────────────────────
 *
 * Verificar o privilégio real exigiria credencial de banco no CI — a troca que
 * este projeto já recusou três vezes. As migrations **são** o histórico de
 * privilégios, em ordem de nome: aplicando cada `GRANT`/`REVOKE` na sequência
 * chega-se ao estado final.
 *
 * **O que ela não cobre**, dito para ninguém confiar demais: um `GRANT` dado
 * direto no editor SQL, sem migration. Contra isso valem o
 * `espelho-de-migrations.mjs` (que reprova quando a contagem diverge) e a
 * disciplina do `BANCO.md`. O que ela cobre é o caminho realista de a porta
 * reabrir: alguém escrever uma migration que reconcede sem perceber.
 */

const PASTA = 'supabase/migrations';

/** As nove que o trigger protege, mais três que ninguém deve editar. */
const NUNCA_PARA_AUTHENTICATED = [
  'role', 'banned', 'ban_count', 'suspended_until', 'banned_by',
  'banned_by_username', 'banned_at', 'ban_reason', 'ban_details',
  'role_changed_at', 'id', 'created_at', 'username',
];

/** O que a tela de fato edita — lido em `useProfileForm`/`useAvatarUpload`. */
const O_QUE_O_FRONTEND_ESCREVE = [
  'bio', 'birth_date', 'state', 'platform', 'playstyle', 'favorite_games',
  'discord', 'twitch', 'youtube', 'avatar_url', 'notif_likes', 'notif_comments',
];

/**
 * Tira comentário de SQL antes de qualquer regex.
 *
 * Não é zelo: em 17/09 uma trava desta mesma família acusou uma função como
 * aberta porque leu um `GRANT` citado **dentro do comentário** que contava a
 * história. Sétima vez que este projeto é mordido por trava que lê a PROSA em
 * vez do CÓDIGO — e as migrations daqui são cheias de comentário explicando
 * grants antigos, então aqui o risco é máximo.
 */
function semComentariosSQL(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** Estado final do UPDATE por coluna, aplicando as migrations em ordem. */
function updateFinalDeProfiles(migrations) {
  const concedidas = new Set();

  for (const { sql } of migrations) {
    for (const comando of semComentariosSQL(sql).split(';')) {
      if (!/\bON\s+(public\.)?profiles\b/i.test(comando)) continue;
      if (!/\bauthenticated\b/i.test(comando.split(/\bTO\b|\bFROM\b/i)[1] ?? '')) continue;
      if (!/\bUPDATE\b/i.test(comando) && !/\bALL\b/i.test(comando)) continue;

      const colunas = comando.match(/\bUPDATE\s*\(([^)]+)\)/i)?.[1]
        ?.split(',').map((c) => c.trim().toLowerCase());

      if (/^\s*GRANT\b/i.test(comando)) {
        // `GRANT UPDATE ON profiles` sem lista = a tabela inteira.
        if (colunas) colunas.forEach((c) => concedidas.add(c));
        else return null;  // sinaliza "tabela toda", tratado na asserção
      } else if (/^\s*REVOKE\b/i.test(comando)) {
        if (colunas) colunas.forEach((c) => concedidas.delete(c));
        else concedidas.clear();
      }
    }
  }
  return concedidas;
}

describe('SEC-025 — as colunas privilegiadas de `profiles`', () => {
  const arquivos = readdirSync(PASTA).filter((n) => n.endsWith('.sql')).sort();

  it('encontrou as migrations', () => {
    expect(
      arquivos.length,
      `Nenhuma migration em \`${PASTA}\`. Sem elas esta trava aprova tudo.`,
    ).toBeGreaterThan(150);
  });

  const migrations = arquivos.map((nome) => ({ nome, sql: readFileSync(join(PASTA, nome), 'utf8') }));
  const concedidas = updateFinalDeProfiles(migrations);

  it('nenhuma migration devolve a TABELA INTEIRA para `authenticated`', () => {
    expect(
      concedidas,
      'Uma migration deu `GRANT UPDATE ON public.profiles TO authenticated` sem\n'
      + '  lista de colunas — ou seja, a tabela INTEIRA, incluindo `role`.\n\n'
      + '  Isso desfaz a SEC-025 e devolve a protecao para uma camada so: o\n'
      + '  trigger. Conceda por COLUNA, com a lista do que a tela edita.',
    ).not.toBeNull();
  });

  it.each(NUNCA_PARA_AUTHENTICATED)('`%s` não tem UPDATE para authenticated', (coluna) => {
    expect(
      concedidas?.has(coluna) ?? true,
      `\`profiles.${coluna}\` voltou a ser escrivel por \`authenticated\`.\n\n`
      + '  Esta e a coluna que sustenta a autorizacao do site inteiro:\n'
      + '  `is_staff()` = role_rank(profiles.role de auth.uid()) >= 2.\n\n'
      + '  Com ela escrivel, a UNICA barreira volta a ser o trigger\n'
      + '  `trg_guard_profile_privileged` — e camada unica cai sem avisar.\n\n'
      + '  Se a tela passou a precisar disto, o caminho e uma RPC com guard,\n'
      + '  como `owner_set_role` — nao um GRANT.',
    ).toBe(false);
  });

  it.each(O_QUE_O_FRONTEND_ESCREVE)('`%s` CONTINUA escrivel — senão a tela quebra', (coluna) => {
    expect(
      concedidas?.has(coluna),
      `\`profiles.${coluna}\` perdeu o UPDATE de \`authenticated\`.\n\n`
      + '  Esta coluna e escrita pelo formulario do proprio perfil. Sem o grant,\n'
      + '  salvar o perfil passa a falhar para todo mundo.\n\n'
      + '  Esta metade da trava existe porque revogar coluna de `profiles` ja\n'
      + '  derrubou este site TRES vezes (POSTURA §1.3). Least privilege que\n'
      + '  quebra a tela nao e seguranca, e indisponibilidade.',
    ).toBe(true);
  });
});
