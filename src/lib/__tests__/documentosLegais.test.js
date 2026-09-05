import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  DOCUMENTOS, DOCUMENTOS_DO_BANCO, aceitesParaGravar, documentosPendentes,
} from '../documentosLegais';

/**
 * ── A deriva que esta trava impede ──────────────────────────────────────────
 *
 * A lista de documentos existe em DOIS lugares: no `CHECK` da tabela
 * `policy_acceptances` e no mapa `DOCUMENTOS` do JS. Documento novo só de um
 * lado produz o pior desfecho possível deste recurso: o aceite é **recusado
 * pelo banco** e a pessoa não consegue criar conta, com uma mensagem que
 * ninguém entende.
 *
 * ── E a trava do FORMATO da versão ──────────────────────────────────────────
 *
 * O banco exige `^\d{4}-\d{2}-\d{2}(-\d+)?$`. Uma versão escrita como "v2" aqui
 * passaria no build, passaria no lint, e só quebraria no cadastro de um
 * usuário de verdade.
 */
describe('documentos legais', () => {
  it('o mapa do JS tem EXATAMENTE os documentos que o banco aceita', () => {
    expect(Object.keys(DOCUMENTOS).sort()).toEqual([...DOCUMENTOS_DO_BANCO].sort());
  });

  it('toda versão está no formato que o CHECK do banco exige', () => {
    for (const [chave, doc] of Object.entries(DOCUMENTOS)) {
      expect(doc.versao,
        `A versao de "${chave}" precisa ser AAAA-MM-DD, com sufixo -N opcional\n`
        + '  para a segunda revisao do mesmo dia (ex.: 2026-09-02-2).\n'
        + '  O CHECK da tabela policy_acceptances recusa qualquer outra coisa,\n'
        + '  e a recusa aparece como "nao consegui criar a conta".')
        .toMatch(/^\d{4}-\d{2}-\d{2}(-\d+)?$/);
    }
  });

  // ── A trava do CONTEÚDO ───────────────────────────────────────────────────
  //
  // O bug que ela impede ja aconteceu, em 02/09/2026: o dono aceitou a politica
  // na versao "2026-09-02" as 19:58 UTC, e horas depois o bloco "por quanto
  // tempo guardamos seu dado" foi reescrito de "falta definir" para uma tabela
  // com seis prazos. A versao nao se moveu. O registro de aceite passou a
  // afirmar que ele concordou com um texto que nunca viu.
  //
  // A regra de "suba a versao quando o conteudo mudar" ja existia e estava
  // escrita. Ela falhou porque NADA percebia que o conteudo tinha mudado — e
  // responder a isso com mais uma frase na documentacao seria repetir o que ja
  // nao funcionou (§2: comentario e a mais fraca das cinco travas).
  //
  // Ela cobra DECISAO, nao versao nova. Exigir reaceite a cada virgula
  // treinaria todo mundo a clicar sem ler, que e o dano oposto e igualmente
  // real.
  //
  // `[05/09]` `conteudo` virou LISTA, e a razao vale escrever: ao dividir o
  // arquivo da politica, as duas listas declaradas (chaves de armazenamento e
  // terceiros) sairam para um arquivo proprio — e sairam de baixo desta
  // impressao junto. A vigilancia teria diminuido em silencio, que e o defeito
  // que esta trava existe para impedir. Um documento pode ser feito de varios
  // arquivos; a impressao cobre todos, na ordem declarada.
  it('o conteúdo de cada documento bate com a impressão registrada', () => {
    for (const [chave, doc] of Object.entries(DOCUMENTOS)) {
      const h = createHash('sha256');
      for (const arquivo of doc.conteudo) h.update(readFileSync(arquivo));
      const atual = h.digest('hex').slice(0, 16);

      expect(atual,
        `O conteudo de "${chave}" (${doc.conteudo.join(', ')}) mudou e a impressao em\n`
        + '  src/lib/documentosLegais.js nao acompanhou.\n\n'
        + '  Isto NAO e erro: e a decisao que so voce pode tomar.\n\n'
        + '  A mudanca e relevante para quem le o documento — o que a gente\n'
        + '  coleta, o que a pessoa pode fazer, o que acontece com a conta?\n'
        + `    SIM  -> suba "versao" (hoje ${doc.versao}) E "impressao" para\n`
        + `            ${atual}. Todo mundo sera avisado para reaceitar.\n`
        + `    NAO  -> mudanca cosmetica: suba SO "impressao" para ${atual}.\n`
        + '            Ninguem e incomodado.\n\n'
        + '  Sem isto, o aceite ja gravado passa a apontar para um texto que a\n'
        + '  pessoa nunca leu — foi o que aconteceu em 02/09/2026.')
        .toBe(doc.impressao);
    }
  });

  it('todo documento aponta para um arquivo de conteúdo que existe', () => {
    // Sem isto, renomear o arquivo faria `readFileSync` estourar e alguem
    // "consertaria" apagando o caminho — e a trava de cima morreria junto.
    for (const [chave, doc] of Object.entries(DOCUMENTOS)) {
      expect(Array.isArray(doc.conteudo) && doc.conteudo.length > 0,
        `"${chave}" sem lista de arquivos de conteudo`).toBe(true);
      for (const arquivo of doc.conteudo) {
        expect(() => readFileSync(arquivo),
          `O arquivo de conteudo de "${chave}" (${arquivo}) nao existe.\n`
          + '  Ele foi renomeado ou movido? Atualize o caminho em\n'
          + '  src/lib/documentosLegais.js — NAO apague o campo, ou a trava de\n'
          + '  conteudo para de vigiar este documento para sempre.')
          .not.toThrow();
      }
    }
  });

  it('todo documento tem rótulo e uma rota que existe no App', () => {
    // Link quebrado numa tela de consentimento e a pessoa aceita sem poder ler.
    const app = readFileSync('src/App.jsx', 'utf8');
    for (const [chave, doc] of Object.entries(DOCUMENTOS)) {
      expect(doc.rotulo, `"${chave}" sem rotulo`).toBeTruthy();
      expect(app,
        `A rota ${doc.caminho} ("${chave}") nao existe no App.jsx.\n`
        + '  A caixinha de aceite linka para la — link quebrado numa tela de\n'
        + '  consentimento faz a pessoa aceitar sem poder ler.')
        .toContain(`path="${doc.caminho}"`);
    }
  });

  it('todo documento PÚBLICO tem um documento legal correspondente', () => {
    // ── A trava de CLASSE ─────────────────────────────────────────────────
    // O risco não é o documento de hoje: é o quarto documento, criado sem
    // entrar no aceite. Aí o site passa a ter uma regra que ninguém aceitou.
    const paginas = readdirSync('src/components')
      .filter(d => ['privacidade', 'regras', 'termos'].includes(d));
    expect(paginas.length,
      'nenhuma pasta de documento encontrada em src/components — o caminho\n'
      + '  mudou? Sem isto esta trava passaria verde para sempre.')
      .toBeGreaterThan(0);
    const semAceite = paginas.filter(p => !DOCUMENTOS[p]);
    expect(semAceite,
      `Documento publico sem entrada em DOCUMENTOS: ${semAceite.join(', ')}.\n`
      + '  Ele existe no site e ninguem aceitou. Acrescente em\n'
      + '  src/lib/documentosLegais.js E no CHECK da tabela policy_acceptances.')
      .toEqual([]);
  });

  it('aceitesParaGravar produz uma linha por documento, com o usuário', () => {
    const linhas = aceitesParaGravar('abc-123');
    expect(linhas).toHaveLength(Object.keys(DOCUMENTOS).length);
    for (const l of linhas) {
      expect(l.user_id).toBe('abc-123');
      expect(DOCUMENTOS[l.documento].versao).toBe(l.versao);
    }
  });
});

describe('documentosPendentes', () => {
  const versao = c => DOCUMENTOS[c].versao;
  const todos = () => Object.keys(DOCUMENTOS)
    .map(c => ({ documento: c, versao: versao(c) }));

  it('tudo aceito na versão vigente: nada pendente', () => {
    expect(documentosPendentes(todos())).toEqual([]);
  });

  it('conta sem aceite nenhum: tudo pendente', () => {
    // O caso das contas criadas antes de 02/09.
    expect(documentosPendentes([])).toEqual(Object.keys(DOCUMENTOS));
  });

  it('aceitou a versão ANTIGA: aquele documento fica pendente', () => {
    const aceites = todos().map(a => (a.documento === 'termos'
      ? { ...a, versao: '2020-01-01' } : a));
    expect(documentosPendentes(aceites)).toEqual(['termos']);
  });

  it('consulta que FALHOU devolve null, e não "tudo pendente"', () => {
    // ── A distinção que evita o pior comportamento possível ───────────────
    // Se falha virasse lista cheia, toda queda de rede pediria reaceite a
    // quem ja aceitou tudo. Dois estados diferentes num valor so e o §4.
    expect(documentosPendentes(null)).toBeNull();
    expect(documentosPendentes(undefined)).toBeNull();
  });
});
