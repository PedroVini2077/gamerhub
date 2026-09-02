import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { DOCUMENTOS, DOCUMENTOS_DO_BANCO, aceitesParaGravar } from '../documentosLegais';

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
 * O banco exige `^\d{4}-\d{2}-\d{2}$`. Uma versão escrita como "v2" aqui
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
        `A versao de "${chave}" precisa ser uma data AAAA-MM-DD.\n`
        + '  O CHECK da tabela policy_acceptances recusa qualquer outra coisa,\n'
        + '  e a recusa aparece como "nao consegui criar a conta".')
        .toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
