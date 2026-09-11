import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { DOCUMENTOS, DOCUMENTOS_DO_BANCO, aceitesParaGravar } from '../documentosLegais';

/**
 * O aceite que o cliente manda tem que ser o que o banco aceita.
 *
 * ── O bug que originou isto ─────────────────────────────────────────────────
 *
 * `[11/09]` Com confirmação de email ligada, `supabase.auth.signUp` cria o
 * usuário e **não abre sessão**. O cliente segue como `anon`, e a policy de
 * INSERT de `policy_acceptances` é `TO authenticated` com
 * `user_id = auth.uid()`. Resultado: **todo cadastro novo ficava sem a prova
 * do consentimento**, e a pessoa via um erro vermelho na tela.
 *
 * O conserto foi mover a escrita para o `handle_new_user`, que é
 * `SECURITY DEFINER` e roda na mesma transação da criação da conta. As
 * coordenadas do aceite viajam no metadata do `signUp`.
 *
 * ── Por que a trava é de CONTRATO, e não um teste de comportamento ──────────
 *
 * O conserto criou uma deriva possível entre dois lugares (§6, Fase 4): o JS
 * decide **quais** documentos manda, e o trigger decide **quais** aceita. Se
 * os dois discordarem, o aceite é descartado **em silêncio** — o trigger pula
 * o item inválido de propósito, para não derrubar o cadastro.
 *
 * É exatamente a forma de falha do §1.5: nada estoura, nada loga, e o registro
 * simplesmente não existe. Esta trava é o que impede isso de voltar.
 */

/** A lista que o trigger aceita, lida da migration — não de uma cópia. */
function documentosQueOTriggerAceita() {
  // Caminho relativo ao cwd, como as outras travas deste projeto — `process`
  // não existe no ambiente de lint destes testes.
  const sql = readFileSync(
    'supabase/migrations/20260911112405_aceite_dos_documentos_nasce_com_a_conta.sql', 'utf8');
  const m = sql.match(/documento'\)\s*NOT IN \(([^)]+)\)/);
  if (!m) {
    throw new Error(
      'Não achei a lista de documentos dentro da migration do `handle_new_user`. '
      + 'Se ela mudou de forma, este teste precisa acompanhar — senão ele passa '
      + 'a aprovar qualquer coisa, que é pior do que não existir.',
    );
  }
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
}

describe('o aceite nasce com a conta', () => {
  it('todo documento que o cliente MANDA é aceito pelo trigger', () => {
    const doTrigger = new Set(documentosQueOTriggerAceita());
    const doCliente = aceitesParaGravar('id-qualquer').map((a) => a.documento);

    expect(doCliente.length).toBeGreaterThan(0);

    const orfaos = doCliente.filter((d) => !doTrigger.has(d));
    expect(
      orfaos,
      'O cliente manda um documento que o `handle_new_user` NÃO conhece. O '
      + 'trigger pula item desconhecido de propósito (para não derrubar o '
      + 'cadastro), então o aceite some EM SILÊNCIO — ninguém fica sabendo, e '
      + 'a conta nasce sem a prova do consentimento.\n'
      + 'Conserte nos dois lados: acrescente o documento na lista do trigger '
      + '(migration nova) e no `CHECK` de `policy_acceptances`.\n'
      + `Órfãos: ${orfaos.join(', ')}`,
    ).toEqual([]);
  });

  it('a lista do trigger é a mesma que o banco aceita no CHECK', () => {
    const doTrigger = [...documentosQueOTriggerAceita()].sort();
    expect(
      doTrigger,
      'A lista do trigger divergiu de `DOCUMENTOS_DO_BANCO`, que é o espelho do '
      + '`CHECK (documento = ANY (...))` da tabela. Duas listas que precisam '
      + 'concordar e moram em lugares diferentes divergem sozinhas (§4).',
    ).toEqual([...DOCUMENTOS_DO_BANCO].sort());
  });

  it('toda versão enviada passa no formato que o CHECK exige', () => {
    // `CHECK (versao ~ '^\d{4}-\d{2}-\d{2}(-\d+)?$')` — e o trigger repete o
    // mesmo padrão antes de gravar. Versão fora do formato é pulada em
    // silêncio, então ela não pode nascer errada do lado do cliente.
    const formato = /^\d{4}-\d{2}-\d{2}(-\d+)?$/;
    const ruins = Object.entries(DOCUMENTOS)
      .filter(([, { versao }]) => !formato.test(versao))
      .map(([nome, { versao }]) => `${nome}=${versao}`);
    expect(
      ruins,
      'Versão fora do formato `AAAA-MM-DD` (com sufixo `-N` opcional). O '
      + 'trigger a descartaria sem avisar, e o `CHECK` da tabela a recusaria.\n'
      + `Ruins: ${ruins.join(', ')}`,
    ).toEqual([]);
  });

  it('o cadastro NÃO tenta mais escrever o aceite pelo cliente', () => {
    // A chamada antiga falhava em 100% dos cadastros, porque não há sessão
    // logo após o `signUp`. Se ela voltar, o erro vermelho volta com ela.
    const bruto = readFileSync('src/services/cadastroService.js', 'utf8');
    // Sem os comentários: a primeira versão desta trava reprovava por causa do
    // comentário que EXPLICA o bug, e comentário não executa nada. Trava que
    // acusa texto em vez de código é ruído — e ruído ensina a ignorar o canal.
    const fonte = bruto
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(
      /registrarAceiteDosDocumentos\s*\(/.test(fonte) || /import[^;]*registrarAceiteDosDocumentos/.test(fonte),
      'O `cadastroService` voltou a chamar `registrarAceiteDosDocumentos`. '
      + 'Logo após o `signUp` não existe sessão: o cliente é `anon` e a RLS '
      + 'recusa a escrita. Quem grava o aceite do cadastro é o '
      + '`handle_new_user`, pelo metadata.',
    ).toBe(false);
  });
});
