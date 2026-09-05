import { supabase } from '../lib/supabase';
import { from, fromCount, ok, fail } from './result';

/**
 * O canal de contato público — falar com a administração de FORA do site.
 *
 * Pedido do dono em 02/09: *"nós precisamos de uma maneira dos usuários
 * falarem com a administração de fora do site, nem que seja por formulário"*.
 *
 * ── Onde as regras moram, e por que não aqui ────────────────────────────────
 *
 * Faixa de tamanho, lista de assuntos, teto de 3 mensagens por e-mail em 24 h
 * e o disjuntor de 60/hora vivem TODOS na RPC `enviar_mensagem_de_contato`.
 * Este arquivo não repete nenhum deles como validação: o site entrega a anon
 * key, então qualquer regra que só existisse aqui seria pulada por um POST
 * direto em `/rest/v1/rpc/` (§1.3). O que a tela faz com os mesmos números é
 * AVISAR antes de mandar — outra coisa.
 *
 * ── `[03/09]` O envio deixou de falar com a RPC direto ──────────────────────
 *
 * Agora ele passa pela Edge Function `verify-contact`, que confere o captcha
 * no Cloudflare antes. E a RPC **deixou de ser chamável por `anon`** — é o que
 * faz o captcha valer alguma coisa: enquanto ela aceitasse chamada direta, a
 * verificação existiria só para quem já não era ameaça.
 *
 * A leitura e a marcação continuam falando com o banco direto: elas são da
 * equipe, protegidas por RLS, e não têm nada a ver com robô.
 *
 * A mensagem de erro do banco já vem em português e explicando o caso. Quem
 * chama repassa; trocar por "erro ao enviar" genérico manda a pessoa adivinhar
 * qual dos seis limites ela esbarrou (§1.5).
 */
export async function enviarMensagemDeContato({ nome, email, assunto, mensagem, token }) {
  const { error } = await supabase.functions.invoke('verify-contact', {
    body: {
      token,
      nome: nome?.trim() ?? '',
      email: email?.trim() ?? '',
      assunto: assunto ?? '',
      mensagem: mensagem?.trim() ?? '',
    },
  });
  if (!error) return ok({ ok: true });
  return fail({ message: await mensagemDaFuncao(error) });
}

/**
 * Tira do erro do `functions.invoke` a frase que a função realmente escreveu.
 *
 * Sem isto, TODA falha vira *"Edge Function returned a non-2xx status code"* —
 * a mesma frase para "escreva pelo menos 20 caracteres", para "confirme o
 * captcha" e para "o servidor caiu". O trabalho inteiro que a RPC teve de
 * escrever mensagem em português, explicando qual dos seis limites a pessoa
 * esbarrou, morreria aqui (§1.5: toda mensagem de erro tem que ser verdadeira).
 *
 * O corpo da resposta fica em `error.context`, que é a `Response` original.
 */
async function mensagemDaFuncao(error) {
  try {
    const corpo = await error?.context?.json?.();
    if (typeof corpo?.error === 'string' && corpo.error.trim()) return corpo.error;
  } catch { /* resposta sem corpo JSON — cai no genérico abaixo */ }
  // Genérico de propósito, e só aqui: neste ponto a função não disse nada que
  // dê para repassar. Inventar uma causa seria pior do que admitir a falta.
  return 'Nao foi possivel enviar sua mensagem agora. Tente novamente em alguns minutos.';
}

/**
 * A equipe responde, e a resposta SAI POR E-MAIL.
 *
 * `[03/09]` Antes disto o painel tinha um botão "Respondida" e mais nada: o
 * status afirmava um ato que o sistema nunca executava. Quem abrisse depois não
 * distinguia "respondi por fora" de "cliquei sem responder" (§1.5).
 *
 * Passa pela Edge Function `responder-contato` e não por uma RPC direta porque
 * o envio de e-mail acontece FORA do banco — e a ordem lá é o que impede o
 * defeito de voltar: o e-mail sai primeiro, o registro vem depois.
 */
export async function responderMensagemDeContato(id, texto) {
  const { error } = await supabase.functions.invoke('responder-contato', {
    body: { id, texto },
  });
  if (!error) return ok({ ok: true });
  return fail({ message: await mensagemDaFuncao(error) });
}

/**
 * As mensagens, para a equipe. A RLS já limita a `is_staff()` — este `select`
 * não repete a checagem porque repetir criaria a ilusão de que ELA é a
 * proteção. Para quem não é da equipe a resposta é uma lista vazia.
 */
export async function listarMensagensDeContato({ status = null, limite = 50 } = {}) {
  let q = supabase
    .from('contact_messages')
    .select('id, name, email, subject, message, created_at, status, '
          + 'handled_by_username, handled_at, internal_note, reply_text')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (status) q = q.eq('status', status);
  return from(await q, []);
}

/**
 * Marca uma mensagem como lida / respondida / spam.
 *
 * `count: 'exact'` e tratar 0 como falha não é zelo extra: a RLS nega em
 * SILÊNCIO — devolve 0 linhas e nenhum erro. Sem isto o painel diria
 * "marcado como respondido" e nada teria mudado, que é o bug que escondeu por
 * meses a moderação de comentário e de mural (§4).
 */
export async function marcarMensagemDeContato(id, status, { userId, username, nota } = {}) {
  const res = await supabase
    .from('contact_messages')
    .update({
      status,
      // Quem tratou vem do cliente, e isso é aceitável AQUI e não em geral: só
      // a equipe passa pela RLS, e o pior caso é um membro da equipe assinar o
      // nome de outro. Não é dado de segurança — é atribuição de trabalho.
      handled_by: userId ?? null,
      handled_by_username: username ?? null,
      handled_at: new Date().toISOString(),
      ...(nota === undefined ? {} : { internal_note: nota }),
    }, { count: 'exact' })
    .eq('id', id);
  return fromCount(res,
    'Nao foi possivel atualizar a mensagem. Voce ainda faz parte da equipe?');
}
