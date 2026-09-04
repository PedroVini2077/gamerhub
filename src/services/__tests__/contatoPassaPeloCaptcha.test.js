import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Trava do captcha do formulário de contato — a que impede o bypass VOLTAR.
 *
 * ── O que ela protege ───────────────────────────────────────────────────────
 *
 * O captcha só vale porque `enviar_mensagem_de_contato` deixou de ser chamável
 * por `anon`: a única porta agora é a Edge Function `verify-contact`, que
 * confere o token no Cloudflare antes.
 *
 * O jeito mais provável de isso quebrar não é um ataque — é **alguém achando
 * que simplificou**. `supabase.rpc('enviar_mensagem_de_contato', …)` é mais
 * curto, parece igual, e voltaria a passar reto pelo captcha. Só que, com o
 * revoke no lugar, ele passaria a falhar com "permission denied" para TODO
 * MUNDO: o canal de contato fecharia inteiro.
 *
 * Os dois estragos são opostos e o mesmo commit produz um ou o outro conforme o
 * estado do banco. Por isso a trava é aqui, no código, e não só nas portas.
 *
 * ── Por que também o token e a mensagem de erro ─────────────────────────────
 *
 * Sem repassar o `token`, a função recusa tudo com 400 e ninguém envia nada.
 * E sem extrair a frase do corpo da resposta, TODA falha vira "Edge Function
 * returned a non-2xx status code" — a mesma frase para "escreva pelo menos 20
 * caracteres" e para "o servidor caiu" (§1.5).
 */

const invoke = vi.fn();
const rpc = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: (...a) => invoke(...a) },
    rpc: (...a) => rpc(...a),
    from: () => { throw new Error('nao deveria tocar a tabela no envio'); },
  },
}));

const { enviarMensagemDeContato } = await import('../contatoService');

const CAMPOS = {
  nome: 'Fulano', email: 'fulano@example.com', assunto: 'bug',
  mensagem: 'mensagem com mais de vinte caracteres para passar da faixa',
  token: 'token-do-turnstile-vindo-do-widget',
};

describe('enviarMensagemDeContato passa pelo captcha', () => {
  beforeEach(() => { invoke.mockReset(); rpc.mockReset(); });

  it('chama a Edge Function verify-contact, e NAO a RPC direto', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });

    await enviarMensagemDeContato(CAMPOS);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe('verify-contact');
    // Se isto falhar, o envio voltou a bater na RPC direto — e aí ou o captcha
    // virou decoração (banco antigo) ou o canal inteiro parou com "permission
    // denied" (banco atual). Ver a migration 20260903213000_captcha_no_contato.
    expect(rpc).not.toHaveBeenCalled();
  });

  it('leva o token junto — sem ele a funcao recusa todo mundo', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });

    await enviarMensagemDeContato(CAMPOS);

    expect(invoke.mock.calls[0][1].body.token).toBe(CAMPOS.token);
  });

  it('repassa a frase que a funcao escreveu, e nao o erro generico do invoke', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: { json: async () => ({ error: 'Escreva pelo menos 20 caracteres explicando o seu caso.' }) },
      },
    });

    const { error } = await enviarMensagemDeContato(CAMPOS);

    expect(error.message).toBe('Escreva pelo menos 20 caracteres explicando o seu caso.');
  });

  it('quando a resposta nao tem corpo, admite a falta em vez de inventar causa', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { message: 'Failed to fetch', context: { json: async () => { throw new Error('sem corpo'); } } },
    });

    const { error } = await enviarMensagemDeContato(CAMPOS);

    expect(error.message).toMatch(/nao foi possivel enviar/i);
  });
});
