import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `[02/10]` A LISTA DE SECRETS DA RESTAURAÇÃO — derivada do código, não escrita.
 *
 * ── O que aconteceu ───────────────────────────────────────────────────────
 *
 * `supabase/migrations/README.md` diz o que as migrations **não** contêm e
 * precisa ser recriado à mão no dashboard. Entre esses itens está a lista de
 * secrets das Edge Functions — e ela citava **cinco** enquanto o código lia
 * **nove**: faltavam `GROQ_API_KEY`, `TURNSTILE_SECRET_KEY` e os `SMTP_*`.
 *
 * Quem restaurasse o banco por aquele arquivo levantaria um site em que o News
 * não redige, o radar não busca e o contato recusa todo mundo — **sem erro na
 * tela de ninguém**, porque cada uma dessas funções degrada em silêncio quando
 * a chave falta.
 *
 * É §1.5 aplicado à recuperação de desastre, que é literalmente o que aquela
 * pasta existe para não ter: o próprio README conta, seis parágrafos antes, que
 * nasceu de um backup que mentia.
 *
 * ── Por que a trava é esta, e não "lembrar de atualizar" ──────────────────
 *
 * A lista envelheceu porque era escrita à mão e três Edge Functions novas
 * entraram desde que alguém a redigiu. Mais uma regra mandando lembrar
 * repetiria o que já não funcionou (§9.8). Esta checagem **lê o código**:
 * secret novo num `Deno.env.get()` reprova o PR até alguém dizer quem morre
 * sem ele.
 */

const PASTA = 'supabase/functions';
const README = 'supabase/migrations/README.md';

/**
 * Os que a PLATAFORMA injeta sozinha. Ninguém os cria no dashboard, então
 * exigi-los na lista de restauração seria ruído — e ruído ensina a ignorar o
 * canal (§0.2, 4ª regra).
 */
const INJETADOS_PELA_PLATAFORMA = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

function segredosQueOCodigoLe() {
  const achados = new Set();
  let arquivosLidos = 0;
  // Pasta ausente nao pode estourar um `ENOENT` cru: a falha tem de ENSINAR
  // (§2). Ela cai no controle logo abaixo, que diz o que fazer.
  if (!existsSync(PASTA)) return { achados: [], arquivosLidos: 0 };
  for (const dir of readdirSync(PASTA, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const nome of readdirSync(join(PASTA, dir.name)).filter((n) => n.endsWith('.ts'))) {
      arquivosLidos++;
      const src = readFileSync(join(PASTA, dir.name, nome), 'utf8');
      for (const [, chave] of src.matchAll(/Deno\.env\.get\(\s*["']([A-Z0-9_]+)["']/g)) {
        if (!INJETADOS_PELA_PLATAFORMA.includes(chave)) achados.add(chave);
      }
    }
  }
  return { achados: [...achados].sort(), arquivosLidos };
}

describe('a restauracao do banco lista TODOS os secrets', () => {
  const { achados, arquivosLidos } = segredosQueOCodigoLe();

  it('a varredura leu Edge Function de verdade', () => {
    // Controle: pasta renomeada deixaria o teste abaixo verde sobre uma lista
    // vazia — a classe "teste que nao consegue falhar" (varrerFontes).
    expect(arquivosLidos, `nenhum .ts lido em ${PASTA}/. A pasta das Edge `
      + 'Functions mudou de lugar? Sem isto, a checagem abaixo passaria verde '
      + 'sobre uma lista vazia e a restauracao voltaria a perder secret em '
      + 'silencio. Ajuste PASTA neste arquivo.')
      .toBeGreaterThan(9);
    expect(achados.length, 'nenhum `Deno.env.get` encontrado — a forma de ler '
      + 'secret mudou? Entao esta checagem parou de olhar qualquer coisa')
      .toBeGreaterThan(5);
  });

  it('todo secret que o codigo le esta no README da restauracao', () => {
    expect(existsSync(README), `${README} sumiu`).toBe(true);
    const texto = readFileSync(README, 'utf8');
    const faltando = achados.filter((s) => !texto.includes(s));

    expect(faltando, 'estes secrets o codigo LE e o README da restauracao NAO '
      + 'cita. Quem recriar o banco por aquele arquivo levanta um site em que a '
      + 'funcao correspondente falha EM SILENCIO — foi assim que `GROQ_API_KEY`, '
      + '`TURNSTILE_SECRET_KEY` e os `SMTP_*` ficaram de fora. Acrescente na '
      + 'tabela, com a coluna "quem morre sem ele" preenchida.')
      .toEqual([]);
  });

  it('o README nao promete secret que ninguem le mais', () => {
    // O outro lado: chave que saiu do codigo e ficou na lista manda alguem
    // criar um segredo inutil no dashboard, e sugere que algo depende dela.
    const texto = readFileSync(README, 'utf8');
    const citados = [...texto.matchAll(/`([A-Z][A-Z0-9_]{5,})`/g)].map((m) => m[1]);
    const orfaos = [...new Set(citados)]
      .filter((s) => !achados.includes(s) && !INJETADOS_PELA_PLATAFORMA.includes(s));
    expect(orfaos, 'o README cita estes secrets e nenhuma Edge Function os le. '
      + 'Ou a funcao que os usava foi removida, ou o nome mudou.').toEqual([]);
  });
});
