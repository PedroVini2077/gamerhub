import { supabase } from '../lib/supabase';
import { from, fromCount } from './result';

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
 * A mensagem de erro do banco já vem em português e explicando o caso. Quem
 * chama repassa; trocar por "erro ao enviar" genérico manda a pessoa adivinhar
 * qual dos seis limites ela esbarrou (§1.5).
 */
export async function enviarMensagemDeContato({ nome, email, assunto, mensagem }) {
  return from(await supabase.rpc('enviar_mensagem_de_contato', {
    p_nome: nome?.trim() ?? '',
    p_email: email?.trim() ?? '',
    p_assunto: assunto ?? '',
    p_mensagem: mensagem?.trim() ?? '',
  }));
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
          + 'handled_by_username, handled_at, internal_note')
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
