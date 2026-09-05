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

  /**
   * `[05/09]` ESTE TESTE AFIRMAVA O CONTRÁRIO, e a inversão é decisão do dono.
   *
   * Ele exigia que o "Sair" comum continuasse **global**, com a justificativa de
   * *"aparelho compartilhado"*. O dono desmontou o argumento: *"deslogar no
   * celular não pode deslogar no PC… a não ser que tenha uma aba pra identificar
   * dispositivos conectados, tipo Instagram"*.
   *
   * Ele está certo, e o motivo é que a proteção era **cega**: derrubar todas as
   * sessões só serve a quem sabe que existe uma sessão indevida, e este site não
   * tem como contar isso a ninguém. O registro completo está em
   * [DECISOES.md](../../../docs/DECISOES.md).
   *
   * **O teste foi invertido, não apagado.** Ele guardava uma decisão; agora
   * guarda a decisão nova, e a mensagem de falha carrega o histórico — quem
   * esbarrar nela daqui a seis meses precisa saber que os dois escopos já
   * estiveram aqui, e por quê.
   *
   * A vigilância AMPLA — todo ponto de saída do site, inclusive os que ainda não
   * existem — mora em `logoutEhLocal.test.js`. Este aqui é o par do teste do
   * banido, logo acima: os dois olham este arquivo.
   */
  it('o logout COMUM também é local — decisão do dono em 05/09', () => {
    expect(
      corpoDe('signOut'),
      'O botao "Sair" do Header voltou ao escopo GLOBAL (que e o padrao do\n'
      + 'supabase-js quando nao se passa nada, entao isso acontece sozinho ao\n'
      + 'escrever `signOut()`).\n\n'
      + 'Global revoga TODAS as sessoes da conta: sair no celular derruba o PC.\n'
      + 'Decisao do dono em 05/09 — derrubar tudo so faz sentido com uma tela de\n'
      + 'aparelhos conectados, que o site nao tem; sem ela a pessoa so se expulsa\n'
      + 'do proprio outro aparelho.\n\n'
      + 'Quem precisa mesmo revogar tudo troca a senha — e e por isso que a saida\n'
      + 'de AuthConfirm.jsx (depois de redefinir a senha) segue global.',
    ).toMatch(/signOut\(\{\s*scope:\s*'local'\s*\}\)/);
  });
});
