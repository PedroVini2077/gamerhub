import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONFIABILIDADE as DA_TELA, confiabilidadeValida, pedeCautela }
  from '../confiabilidade';

/**
 * `[01/10]` FASE 2 do radar — o vocabulário de confiabilidade vive em DOIS
 * lugares, e eles têm de concordar.
 *
 * ── O lado perigoso, e ele é mudo ─────────────────────────────────────────
 *
 * O servidor ganhar um valor que a tela não conhece: a pauta aparece **sem
 * selo**, nada estoura, nada vai para log. O editor vê uma pauta sem rótulo e
 * conclui que o modelo não classificou — quando na verdade classificou e a
 * tela não soube ler.
 *
 * É a mesma forma de falha que o `vocabularioDoNewsNaoDeriva` pega entre a
 * tela e o `CHECK` do banco, e o mesmo motivo de existir: duas listas
 * escritas à mão divergem na primeira adição.
 *
 * ── Por que aqui são DUAS cópias e não três ───────────────────────────────
 *
 * A confiabilidade **não existe no banco** — ela é sugestão do radar, não
 * coluna de `news_articles`. Por isso o `enum` no esquema JSON é certo aqui e
 * errado na `editoria`: lá seriam três cópias, e a terceira impediria o
 * modelo de produzir uma editoria nova **em silêncio**.
 */

const CONTRATO = readFileSync(
  'supabase/functions/radar-de-pautas/contrato.ts', 'utf8');

/** Os valores que o SERVIDOR manda o modelo usar. */
function doServidor() {
  const bloco = CONTRATO.match(/export const CONFIABILIDADE = \[([\s\S]*?)\] as const;/);
  if (!bloco) {
    throw new Error(
      'Nao achei `export const CONFIABILIDADE = [...] as const` no contrato.\n'
      + '  Sem isso esta trava nao le nada e fica verde para sempre — que e\n'
      + '  exatamente a "cobertura que nao cobre" que ela existe para pegar.');
  }
  const valores = [...bloco[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
  if (valores.length === 0) {
    throw new Error('A lista do servidor veio VAZIA. O extrator quebrou ou '
      + 'alguem esvaziou o vocabulario.');
  }
  return valores;
}

describe('o vocabulário de confiabilidade não deriva entre servidor e tela', () => {
  const servidor = doServidor();
  const tela = Object.keys(DA_TELA);

  it('o extrator leu alguma coisa — senão a trava é decoração', () => {
    expect(servidor.length).toBeGreaterThanOrEqual(4);
  });

  it('todo valor do SERVIDOR a tela sabe desenhar', () => {
    const semSelo = servidor.filter((v) => !confiabilidadeValida(v));
    expect(semSelo, `o servidor manda o modelo usar ${semSelo.join(', ')}, e a `
      + 'tela nao conhece esse(s) valor(es).\n\n'
      + '  A pauta aparece SEM SELO, nada estoura e nada vai para log. O\n'
      + '  editor conclui que o modelo nao classificou — e ele classificou.\n\n'
      + '  Conserto: acrescentar em `src/lib/news/confiabilidade.js`, com\n'
      + '  rotulo, dica e cor.').toEqual([]);
  });

  it('todo valor da TELA o servidor realmente produz', () => {
    // O lado oposto, e ele e mais barato de errar: selo desenhado para caso
    // que nunca chega e codigo morto que parece feature (§6.1).
    const orfaos = tela.filter((v) => !servidor.includes(v));
    expect(orfaos, `a tela desenha selo para ${orfaos.join(', ')}, que o `
      + 'servidor nunca manda o modelo produzir. E codigo morto que parece '
      + 'feature — foi por isso que `tendencia` e `discussao` NAO entraram '
      + 'na Fase 2: nenhuma fonte de hoje os produz.').toEqual([]);
  });

  it('`tendencia` e `discussao` ficaram FORA, e isso é deliberado', () => {
    // O plano define seis. As quinze fontes de hoje sao todas veiculo
    // jornalistico: nenhuma produz "aumento de atencao" nem "comunidade
    // falando". Eles entram na Fase 3, com Trends e comunidade.
    for (const daFase3 of ['tendencia', 'discussao']) {
      expect(servidor, `\`${daFase3}\` entrou no vocabulario sem a fonte que o `
        + 'produz. Se a Fase 3 chegou, atualize ESTE teste junto — e confira '
        + 'que a tela desenha o selo novo.').not.toContain(daFase3);
    }
  });

  it('só rumor e vazamento pedem cautela — alerta em tudo não alerta', () => {
    // Pintar os quatro de cor forte faria o sinal deixar de ser sinal: e a
    // 4a regra do §0.2 aplicada a selo.
    expect(servidor.filter(pedeCautela).sort()).toEqual(['rumor', 'vazamento']);
  });

  it('todo rótulo tem texto E dica — selo sem explicação é sigla', () => {
    for (const [valor, def] of Object.entries(DA_TELA)) {
      expect(def.rotulo, `\`${valor}\` sem rotulo`).toBeTruthy();
      expect(def.dica, `\`${valor}\` sem dica. O selo precisa dizer o que ele `
        + 'significa: "Vazamento" sozinho nao diz se o site conferiu.').toBeTruthy();
      expect(def.classe, `\`${valor}\` sem cor`).toBeTruthy();
    }
  });
});

describe('a tela NÃO promete que o fato foi conferido', () => {
  const TELA = readFileSync('src/components/news/RadarDePautas.jsx', 'utf8');

  it('a ressalva aparece junto da lista de pautas', () => {
    // O modelo le titulo e 160 chars de resumo. "Confirmado" sem ressalva faz
    // o editor concluir que o SITE apurou — e e a mesma familia do endereco
    // inventado: promessa de apuracao sem apuracao.
    expect(TELA, 'a ressalva sumiu da tela. Sem ela, o selo "Confirmado" '
      + 'parece verificacao do GamerHub, e o modelo so leu a manchete.')
      .toMatch(/como a MANCHETE se apresenta/i);
  });

  it('selo desconhecido não é desenhado', () => {
    expect(TELA).toMatch(/confiabilidadeValida\(pauta\.confiabilidade\)/);
  });
});
