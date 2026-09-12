import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[12/09]` SEC-019 — as chaves do `site_config` são as MESMAS nos dois lados.
 *
 * ── O bug que ela impede ────────────────────────────────────────────────────
 *
 * `owner_set_site_config` fazia `INSERT ... ON CONFLICT (key) DO UPDATE` com
 * `p_key text` sem faixa. Chave desconhecida não dava erro: **criava linha
 * nova**. Então um `maintenence_mode` digitado errado respondia sucesso, punha
 * o toast verde na tela, escrevia na trilha de auditoria que a configuração
 * mudou — e o site, que lê `maintenance_mode`, não fazia nada.
 *
 * Nada estoura, nada aparece, nenhum teste quebra. §1.5, no painel cuja função
 * é tirar o site do ar e devolvê-lo.
 *
 * ── Por que a trava é de CONTRATO e não só a lista fechada no SQL ───────────
 *
 * Fechar a lista no banco troca uma falha muda por uma falha alta — bom. Mas
 * cria uma deriva nova: chave acrescentada no painel e esquecida na RPC faz o
 * botão novo falhar com "Chave desconhecida" na cara do dono.
 *
 * Esta trava cobre os dois sentidos. Ela lê a lista do SQL a partir da ÚLTIMA
 * definição da função em `supabase/migrations/` — legítimo porque o portão
 * `espelho-de-migrations.mjs` garante que a pasta e o banco têm o mesmo
 * conteúdo.
 */

const MIGRATIONS = 'supabase/migrations';
const PAINEL = 'src/components/owner/SiteTab.jsx';

/** A última definição de `owner_set_site_config` na pasta de migrations. */
function listaDoBanco() {
  const arquivos = readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort();
  expect(
    arquivos.length,
    `Nao achei migration nenhuma em ${MIGRATIONS}/ — a trava passaria sem ler nada.`,
  ).toBeGreaterThan(100);

  let ultima = null;
  for (const nome of arquivos) {
    const sql = readFileSync(join(MIGRATIONS, nome), 'utf8')
      .split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
    const m = [...sql.matchAll(
      /FUNCTION\s+(?:public\.)?owner_set_site_config[\s\S]*?p_key\s+NOT\s+IN\s*\(([\s\S]*?)\)/gi,
    )].pop();
    if (m) ultima = { chaves: [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]), arquivo: nome };
  }
  return ultima;
}

describe('as chaves do site_config são as mesmas na RPC e no painel', () => {
  it('a lista fechada existe no SQL e o painel conhece exatamente as mesmas', () => {
    const banco = listaDoBanco();
    expect(
      banco,
      'O `owner_set_site_config` nao valida mais `p_key` com uma lista fechada.\n'
      + '  Sem ela, chave desconhecida NAO da erro: o `ON CONFLICT` cria linha\n'
      + '  nova, a RPC responde sucesso, e a configuracao que o site le continua\n'
      + '  como estava. O painel mostra que salvou e nada acontece.',
    ).toBeTruthy();

    // O estado inicial do componente é a lista de chaves que a tela conhece —
    // é dele que sai cada `saveKey(...)`.
    const bloco = readFileSync(PAINEL, 'utf8')
      .match(/const \[config, setConfig\] = useState\(\{([\s\S]*?)\n {2}\}\);/)?.[1];
    expect(
      bloco,
      `Nao consegui ler o estado inicial de config em ${PAINEL}.\n`
      + '  Se a forma do componente mudou, este casamento precisa mudar junto —\n'
      + '  senao a trava fica verde sem ter comparado nada.',
    ).toBeTruthy();
    const doPainel = [...bloco.matchAll(/(\w+):\s*'/g)].map((m) => m[1]);

    expect(doPainel.length, 'Li 0 chaves no painel — a trava ficaria vazia.').toBeGreaterThan(5);

    expect(
      [...banco.chaves].sort(),
      'As chaves de configuracao DIVERGIRAM entre o painel e a RPC.\n'
      + `  ${PAINEL}: ${JSON.stringify([...doPainel].sort())}\n`
      + `  ${banco.arquivo}: ${JSON.stringify([...banco.chaves].sort())}\n`
      + '  Chave que existe no painel e nao na RPC faz o controle novo falhar\n'
      + '  com "Chave desconhecida" na cara do dono. O contrario deixa uma chave\n'
      + '  que nenhuma tela alcanca. Acerte os dois na mesma mudanca.',
    ).toEqual([...doPainel].sort());
  });
});
