import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Trava dos dois logouts do `useAuth` — eles são diferentes de propósito.
 *
 * ── O que motivou ──────────────────────────────────────────────────────────
 *
 * O dono relatou demora ao clicar em "Sair agora" na `BannedScreen`. A causa
 * foi **medida**, não suposta: `signOutBanned` esperava
 * `supabase.auth.signOut()` no escopo global — uma ida ao servidor para
 * revogar refresh tokens — antes de trocar de página. Cinco medições contra o
 * projeto de produção deram **0,30 s a 1,08 s**, a partir de um datacenter com
 * conexão quente; num 4G de celular é bem pior.
 *
 * ── Por que os dois escopos precisam continuar diferentes ───────────────────
 *
 * | Caminho | Escopo | Por quê |
 * | --- | --- | --- |
 * | `signOutBanned` | `local` | a conta está banida: o token não abre nada, a RLS nega tudo, e a sessão que reaparecer cai na `BannedScreen` de novo |
 * | `signOut` (botão "Sair") | global (padrão) | usuário legítimo, possivelmente em aparelho compartilhado — revogar de verdade importa |
 *
 * Trocar qualquer um dos dois é regressão silenciosa: ninguém vê, o site
 * continua funcionando, e o sintoma volta a ser "demora" ou "não desloga
 * direito" meses depois (§1.5).
 *
 * ── Por que ler o fonte em vez de executar o hook ───────────────────────────
 *
 * `useAuth` é o arquivo de maior risco do projeto (§7) e depende de sessão do
 * Supabase, realtime e React. Montá-lo num teste exigiria tanto mock que o
 * teste passaria a provar o mock. O que precisa ser garantido aqui é uma
 * escolha de UMA palavra, e ela é legível direto do código.
 */

const FONTE = readFileSync(
  join(import.meta.dirname, '../useAuth.jsx'), 'utf8',
);

/** O corpo de uma função declarada no arquivo. */
function corpoDe(nome) {
  const m = FONTE.match(new RegExp(`async function ${nome}\\(\\)[\\s\\S]*?\\n  \\}`));
  return m ? m[0] : '';
}

describe('useAuth — os dois logouts', () => {
  it('acha as duas funções (guarda contra o regex quebrar em silêncio)', () => {
    expect(corpoDe('signOut'), 'não achei signOut').toContain('supabase.auth.signOut');
    expect(corpoDe('signOutBanned'), 'não achei signOutBanned').toContain('window.location');
  });

  it('o logout do BANIDO usa escopo local — não espera a rede', () => {
    expect(
      corpoDe('signOutBanned'),
      'O logout do banido voltou a esperar a ida ao servidor.\n'
      + 'Medido em 28/08: 0,30 s a 1,08 s de datacenter, muito pior no 4G — e a\n'
      + 'tela fica parada esse tempo todo depois do clique em "Sair agora".\n'
      + 'Use `signOut({ scope: \'local\' })`: a conta está banida, o token não\n'
      + 'abre nada, e a sessão que reaparecer cai na BannedScreen de novo.',
    ).toMatch(/signOut\(\{\s*scope:\s*'local'\s*\}\)/);
  });

  it('o logout do banido troca de página logo depois', () => {
    expect(
      corpoDe('signOutBanned'),
      'sem o redirect, a tela de banido continuaria montada sobre uma sessão morta',
    ).toMatch(/window\.location\.replace\('\/'\)/);
  });

  it('a saída do banido vai para a LANDING, nunca para o /login', () => {
    expect(
      corpoDe('signOutBanned'),
      'A landing é a porta de entrada e a única página que não depende do banco.\n'
      + 'Mandar quem acabou de ser recusado para o formulário de login sugere\n'
      + 'tentar de novo o que não vai dar certo.',
    ).not.toMatch(/replace\('\/login'\)/);
  });

  it('o logout COMUM continua global — ele não pode herdar o atalho', () => {
    const comum = corpoDe('signOut');
    expect(
      comum,
      'O botão "Sair" do Header passou a usar escopo local. Para usuário\n'
      + 'legítimo, possivelmente em aparelho compartilhado, revogar os refresh\n'
      + 'tokens no servidor é o comportamento certo — o atalho vale só para\n'
      + 'quem está banido, onde o token já não abre nada.',
    ).not.toMatch(/scope:\s*'local'/);
    expect(comum).toMatch(/await supabase\.auth\.signOut\(\)/);
  });
});
