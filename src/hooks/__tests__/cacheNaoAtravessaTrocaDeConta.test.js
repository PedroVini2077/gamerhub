import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { varrerFontes } from '../../lib/__tests__/varrerFontes';

/**
 * TRAVA: o cache do React Query não pode sobreviver a uma troca de conta.
 *
 * ── O achado (SEC-006, auditoria de 10/09) ──────────────────────────────────
 *
 * O cache vive em MEMÓRIA, e várias chaves privilegiadas **não levam o usuário
 * dentro delas** — `['owner_users']`, `['owner_audit_logs']`, `['owner_stats']`,
 * `['reports']`, `['role_change_requests','pending']`.
 *
 * Sair do site **não recarrega a página** (só a saída do banido faz `replace`),
 * e nada limpava o cache: `signOut()` fazia `signOut` no Supabase e
 * `setProfile(null)`, mais nada. O dado do dono continuava na memória da aba
 * quando outra pessoa entrava nela.
 *
 * ── Por que isto importa mais do que parece ─────────────────────────────────
 *
 * Sozinho não vazava: a tela do painel não monta para quem não é owner. **Mas é
 * exatamente a consequência de backend que faltava** para o spoof de `role` do
 * DevTools — o teste que o dono fez em 10/09 — deixar de ser inofensivo. Com o
 * painel montado à força, o React Query serviria o cache **antes** de qualquer
 * refetch ser negado pelo banco.
 *
 * O prompt classificou o spoof como *"client-side trust / expected
 * tamperability"* **enquanto não houvesse consequência backend**. Esta era a
 * consequência.
 *
 * ── Por que a limpeza é por IDENTIDADE, e não por evento ────────────────────
 *
 * `onAuthStateChange` também dispara em `TOKEN_REFRESHED`. Limpar a cada
 * disparo faria o site refazer **todas** as consultas de hora em hora — egress
 * à toa, que é a cota mais apertada do plano (§0.2). Por isso a comparação com
 * `idAnterior`.
 *
 * ── Por que este teste lê o ARQUIVO ─────────────────────────────────────────
 *
 * Reproduzir de verdade exigiria duas sessões reais no mesmo navegador, com
 * contas de papéis diferentes — é caso de e2e, não de unidade. Esta trava
 * garante que as três peças continuam no lugar, e **diz que não prova o
 * comportamento** (§1.1).
 *
 * O que ela NÃO cobre: que o `clear()` acontece antes do primeiro render da
 * tela seguinte. Isso é ordem de execução, e só um teste de navegador mostra.
 */
const FONTE = 'src/hooks/useAuth.jsx';

describe('o cache não atravessa uma troca de conta', () => {
  const codigo = readFileSync(FONTE, 'utf8');

  it('o arquivo foi mesmo lido', () => {
    expect(codigo.length, `${FONTE} veio vazio — o hook mudou de lugar?`)
      .toBeGreaterThan(3000);
  });

  it('a troca de identidade limpa o cache', () => {
    expect(codigo,
      'o `queryClient.clear()` sumiu de useAuth.\n\n'
      + '  Sem ele, o cache do React Query ATRAVESSA a troca de conta: varias\n'
      + '  chaves privilegiadas nao levam o usuario dentro (owner_users,\n'
      + '  owner_audit_logs, reports...), e sair do site nao recarrega a pagina.\n'
      + '  O dado de quem saiu fica na memoria da aba para quem entrar.\n\n'
      + '  Era a consequencia de backend que faltava para o spoof de `role` no\n'
      + '  DevTools deixar de ser inofensivo — ver SEC-006 em\n'
      + '  db/2026-09-10-auditoria-seguranca.md.')
      .toMatch(/queryClient\.clear\(\)/);
  });

  it('a limpeza é por IDENTIDADE, não a cada evento de auth', () => {
    expect(codigo,
      'a limpeza do cache deixou de comparar a identidade anterior.\n\n'
      + '  `onAuthStateChange` dispara tambem em TOKEN_REFRESHED. Limpar a cada\n'
      + '  disparo faz o site refazer TODAS as consultas de hora em hora —\n'
      + '  egress a toa, e egress e a cota mais apertada do plano (§0.2).\n'
      + '  Mantenha a comparacao com `idAnterior`.')
      .toMatch(/idNovo\s*!==\s*idAnterior\.current/);
  });

  it('nenhuma chave privilegiada nova aparece sem o usuário dentro', () => {
    // A defesa de verdade contra este achado não é só limpar o cache: é a chave
    // carregar de quem é o dado. Esta parte vigia a DERIVA — chave nova de
    // painel que nasça sem identidade volta a depender só do `clear()`.
    const suspeitas = [];
    for (const caminho of varrerFontes('src')) {
      const fonte = readFileSync(caminho, 'utf8');
      for (const m of fonte.matchAll(/queryKey:\s*\[\s*'(owner_[a-z_]+|admin_[a-z_]+)'([^\]]*)\]/g)) {
        const [, chave, resto] = m;
        if (!/user|\bid\b/i.test(resto)) suspeitas.push(`${chave} (${caminho})`);
      }
    }

    // Não reprova pelas que JÁ existem: elas são o estado conhecido, e o
    // `clear()` acima é o que as cobre. Reprova se aparecerem MAIS do que as
    // que existiam quando esta trava foi escrita.
    expect(suspeitas.length,
      'apareceu chave de painel nova SEM o usuario dentro:\n'
      + `    ${suspeitas.join('\n    ')}\n\n`
      + '  Chave privilegiada sem identidade depende inteiramente do\n'
      + '  `queryClient.clear()` para nao vazar entre contas. Prefira levar o\n'
      + '  usuario na chave — ex.: `[\'owner_users\', user?.id]` — que e defesa\n'
      + '  em profundidade e nao custa nada.')
      .toBeLessThanOrEqual(6);
  });
});
