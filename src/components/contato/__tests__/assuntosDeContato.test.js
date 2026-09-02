import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ASSUNTOS, ASSUNTOS_DO_BANCO, assuntoDeContato,
} from '../assuntosDeContato';

/**
 * ── A deriva que esta trava impede ──────────────────────────────────────────
 *
 * A lista de assuntos existe em DOIS lugares: no `CHECK` da tabela
 * `contact_messages` e no mapa `ASSUNTOS` do JS. Dois lugares que precisam
 * concordar para sempre é a definição de deriva (§6 FASE 4), e a forma como
 * ela se manifesta aqui já aconteceu neste projeto: o tipo `chat` chegou na
 * fila de moderação, não existia em nenhum mapa, e a tela ficou girando.
 *
 * ── Por que a fonte é o ARQUIVO SQL, e não uma constante escrita à mão ──────
 *
 * Um teste que só comparasse `ASSUNTOS` com `ASSUNTOS_DO_BANCO` compararia
 * duas coisas que a MESMA pessoa escreve no mesmo minuto — passaria sempre,
 * porque quem esquece um lado esquece os dois. Lendo o `CHECK` de dentro do
 * relatório da migration, a comparação passa a ser contra o que foi de fato
 * aplicado no banco.
 */
const RELATORIO = 'db/2026-09-02-canal-de-contato.md';

/** Extrai a lista de dentro do `CHECK (subject IN (...))` do SQL aplicado. */
function assuntosDoSqlAplicado() {
  let sql;
  try {
    sql = readFileSync(RELATORIO, 'utf8');
  } catch {
    throw new Error(
      `Nao consegui ler ${RELATORIO}.\n`
      + '  Ele foi renomeado? Sem este arquivo esta trava nao tem contra o que\n'
      + '  comparar e passaria VERDE para sempre. Aponte para o relatorio novo.');
  }
  const m = sql.match(/CHECK \(subject IN \(([^)]*)\)\)/);
  if (!m) {
    throw new Error(
      `Nao achei "CHECK (subject IN (...))" em ${RELATORIO}.\n`
      + '  O bloco SQL do relatorio mudou de forma. Esta trava le dali para\n'
      + '  comparar o mapa do JS com o que foi APLICADO no banco — conserte o\n'
      + '  padrao aqui, nao apague a trava.');
  }
  return m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
}

describe('assuntos do contato', () => {
  it('o mapa do JS tem EXATAMENTE os assuntos que o banco aceita', () => {
    const noBanco = assuntosDoSqlAplicado();
    expect(ASSUNTOS_DO_BANCO,
      'A copia declarada saiu de sincronia com o CHECK aplicado no banco.')
      .toEqual(noBanco);

    const faltando = noBanco.filter(a => !ASSUNTOS[a]);
    expect(faltando,
      `Assunto que o banco aceita e o mapa do JS nao conhece: ${faltando.join(', ')}.\n`
      + '  Uma mensagem com esse assunto chegaria no painel SEM rotulo e sem\n'
      + '  icone. Acrescente em src/components/contato/assuntosDeContato.js.')
      .toEqual([]);

    const sobrando = Object.keys(ASSUNTOS).filter(a => !noBanco.includes(a));
    expect(sobrando,
      `Assunto oferecido no formulario que o banco RECUSA: ${sobrando.join(', ')}.\n`
      + '  Quem escolhesse essa opcao tomaria "Escolha um assunto valido" sem\n'
      + '  entender por que. Acrescente no CHECK da tabela, com migration.')
      .toEqual([]);
  });

  it('todo assunto tem rótulo, ícone e cor', () => {
    for (const [valor, meta] of Object.entries(ASSUNTOS)) {
      expect(meta.rotulo, `assunto "${valor}" sem rotulo`).toBeTruthy();
      expect(meta.icone, `assunto "${valor}" sem icone`).toBeTruthy();
      expect(meta.cor, `assunto "${valor}" sem cor`).toBeTruthy();
    }
  });

  it('assunto desconhecido devolve undefined, e NÃO um palpite', () => {
    // O contrário disto é o fallback silencioso do §4: um `?? ASSUNTOS.outro`
    // faria uma mensagem de assunto desconhecido aparecer no painel como
    // "Outro assunto", e ninguem saberia que o mapa ficou para tras.
    expect(assuntoDeContato('assunto_que_nao_existe')).toBeUndefined();
  });
});
