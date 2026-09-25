import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MINIMO_DE_NOTAS, MARCADOR_DE_LACUNA, lacunasDoRascunho } from '../../lib/news/rascunhoDeIa';

/**
 * `[25/09]` A IA que rascunha matéria — o que ela NUNCA pode voltar a fazer.
 *
 * ── Por que uma trava que lê a Edge Function ──────────────────────────────
 *
 * O desenho inteiro desta feature mora em **dois lugares que precisam
 * concordar**: a instrução dentro de `supabase/functions/redigir-materia` e a
 * tela que a consome. É a FASE 4 do §6 na letra — cada lado está correto por
 * dentro, e o bug nasce da combinação.
 *
 * Nenhuma das quatro derivas abaixo estoura em runtime. Todas produzem o mesmo
 * sintoma: a tela continua funcionando e passa a **mentir** — e mentira que
 * chega ao revisor vale menos do que erro nenhum, porque ele para de conferir.
 */

const CAMINHO = 'supabase/functions/redigir-materia/index.ts';
const FONTE = readFileSync(CAMINHO, 'utf8');

// Se o arquivo for renomeado ou esvaziado, os testes abaixo virariam verde
// sobre nada. A mesma guarda do `varrerFontes`, aplicada a um arquivo só.
if (FONTE.length < 2000) {
  throw new Error(
    `${CAMINHO} tem ${FONTE.length} caracteres — pequeno demais para ser a funcao.\n`
    + '  Ela foi movida ou apagada? Sem esta guarda, as travas deste arquivo\n'
    + '  passariam sem ter lido uma linha da funcao que elas vigiam.');
}

describe('a IA do News nao escreve no banco', () => {
  it('a Edge Function nao toca `news_articles` de jeito nenhum', () => {
    // A regra do dono: *"ela não vai postar nada sozinha, vai passar pela
    // administração e por mim"*. Na tela isso é um clique; aqui é a prova de
    // que não existe caminho pelo qual ela contorne o clique.
    //
    // O que barra: a funcao roda com a SERVICE ROLE quando grita em
    // `admin_logs`. Se alguem um dia acrescentar um `.from('news_articles')`
    // usando esse mesmo cliente, ele passa por cima de TODA a RLS e de todo o
    // corte editorial — sem erro, sem log e sem revisor.
    const ESCREVEU = 'a Edge Function da IA voltou a tocar o banco. Ela NAO pode: '
      + 'o cliente de service role que ela usa para gritar em `admin_logs` passa '
      + 'por cima de toda a RLS e de todo o corte editorial. Uma escrita aqui '
      + 'publicaria materia sem revisor, sem erro e sem log. O rascunho volta na '
      + 'RESPOSTA; quem escreve no banco e a tela, depois do clique de quem assina.';
    expect(FONTE, ESCREVEU).not.toMatch(/news_articles/);
    expect(FONTE, ESCREVEU).not.toMatch(/\.from\s*\(/);
    expect(FONTE, ESCREVEU).not.toMatch(/\.(insert|upsert|delete)\s*\(/);
  });

  it('a unica RPC que ela chama e de leitura de papel', () => {
    const rpcs = [...FONTE.matchAll(/\.rpc\(\s*"([^"]+)"/g)].map((m) => m[1]);
    // `registrar_falha_de_edge_function` é a trilha do §1.5; `is_staff` é a
    // porta. Qualquer outra RPC aqui é escrita disfarçada.
    expect(rpcs.sort()).toEqual(['is_staff', 'registrar_falha_de_edge_function']);
  });
});

describe('a porta da IA e da EQUIPE', () => {
  it('exige `is_staff()` e responde 403 a quem nao e', () => {
    // A `moderate-links` ensinou o custo de porta decorativa: qualquer um da
    // internet queimava a cota do projeto. Aqui a cota é de um provedor de IA,
    // e estourada ela para de redigir para todo mundo.
    expect(FONTE).toMatch(/rpc\(\s*"is_staff"\s*\)/);
    expect(FONTE).toMatch(/ehEquipe\s*!==\s*true[\s\S]{0,200}?403/);
  });

  it('valida o token de verdade, e nao so a presenca do cabecalho', () => {
    expect(FONTE).toMatch(/auth\.getUser\(\)/);
  });
});

describe('sem notas nao ha materia — e os dois lados concordam no numero', () => {
  it('o minimo do servidor e o mesmo que a tela cobra', () => {
    const m = FONTE.match(/notas\.length\s*<\s*(\d+)/);
    expect(m, 'a checagem `notas.length < N` sumiu da Edge Function — '
      + 'sem ela o modelo passa a receber pedido sem fato nenhum, que e '
      + 'exatamente a alucinacao que este desenho existe para evitar').toBeTruthy();

    expect(Number(m[1]), 'o minimo de notas divergiu entre a tela e o servidor. '
      + `A tela cobra ${MINIMO_DE_NOTAS}, a Edge Function cobre ${m[1]}. `
      + 'Acerte os dois: `MINIMO_DE_NOTAS` em src/lib/news/rascunhoDeIa.js e '
      + `a linha \`notas.length < N\` em ${CAMINHO}.`).toBe(MINIMO_DE_NOTAS);
  });

  it('a instrucao proibe fato fora das notas', () => {
    // A frase é o mecanismo, não decoração. Sem ela o modelo volta a ser
    // repórter — e repórter que não apurou inventa.
    expect(FONTE).toMatch(/APENAS a partir das notas/);
    expect(FONTE).toMatch(/NAO tem conhecimento proprio/);
  });
});

describe('o marcador de lacuna e um contrato entre a instrucao e a tela', () => {
  it('o marcador que o servidor manda escrever e contado pela tela', () => {
    // O lado perigoso desta deriva é assimétrico: se o servidor mudar o
    // marcador, a tela passa a dizer "0 lacunas" sobre um rascunho cheio
    // delas — e "0 lacunas" é a frase que faz o revisor ler com menos atencao.
    const m = FONTE.match(/\[([A-Z]+):\s*o que falta\]/);
    expect(m, 'a instrucao nao manda mais marcar a lacuna com `[PALAVRA: o que falta]`. '
      + 'Se o formato mudou, mude junto `MARCADOR_DE_LACUNA` em '
      + 'src/lib/news/rascunhoDeIa.js — senao a tela conta zero para sempre.').toBeTruthy();

    const exemplo = `texto [${m[1]}: a data do lancamento] texto`;
    expect(lacunasDoRascunho({ corpo: exemplo }),
      `o marcador \`[${m[1]}:\` que o servidor manda escrever NAO casa com `
      + `${MARCADOR_DE_LACUNA} na tela. A contagem de lacunas viraria sempre 0.`).toBe(1);
  });

  it('conta em TODOS os campos, nao so no corpo', () => {
    // Lacuna no título é a pior delas: é o que se lê primeiro e o que vira
    // manchete. Contar só o corpo deixaria essa passar.
    expect(lacunasDoRascunho({
      titulo: 'Jogo sai em [CONFERIR: data]',
      subtitulo: '', resumo: 'por [conferir: quanto]', corpo: 'nada aqui',
    })).toBe(2);
  });

  it('nao se engana com colchete comum', () => {
    expect(lacunasDoRascunho({ corpo: 'um [aparte] qualquer e um array[0]' })).toBe(0);
  });
});

describe('a marca de IA chega em quem revisa', () => {
  // A coluna existir no banco nao basta: se a lista do painel nao a PEDIR, o
  // `select` volta sem ela, `a.redigido_com_ia` fica `undefined`, e a marca
  // some de todas as telas sem erro nenhum. Silencio de manual (§1.5): o
  // revisor deixa de saber que o texto e de modelo e ninguem percebe.
  const SERVICE = readFileSync('src/services/newsEditorialService.js', 'utf8');
  const TELAS = [
    'src/components/news/PainelEditorial.jsx',
    'src/components/news/EditorDeArtigo.jsx',
    'src/components/owner/FilaEditorialTab.jsx',
  ];

  it('a lista do painel pede a coluna `redigido_com_ia`', () => {
    const lista = SERVICE.match(/COLUNAS_DO_PAINEL\s*=([\s\S]*?);/)?.[1] ?? '';
    expect(lista, 'COLUNAS_DO_PAINEL nao pede mais `redigido_com_ia`. Sem ela o '
      + 'campo volta `undefined` e a marca de IA some das listas em silencio — '
      + 'quem revisa deixa de saber que o texto saiu de um modelo.')
      .toMatch(/redigido_com_ia/);
  });

  it('as tres telas que listam materia mostram a marca', () => {
    const semMarca = TELAS.filter((t) => !readFileSync(t, 'utf8').includes('MarcaDeIa'));
    expect(semMarca, 'estas telas listam materia e deixaram de mostrar a marca de IA. '
      + 'Ela existe para o revisor saber ANTES de ler: texto de modelo e plausivel '
      + 'por construcao, e plausivel e o que passa por leitura corrida.').toEqual([]);
  });
});
