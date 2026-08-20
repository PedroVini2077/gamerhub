import toast from 'react-hot-toast';

/**
 * Curtida otimista que DESFAZ sozinha quando o servidor recusa.
 *
 * Antes os três lugares que curtem (post, mural, comentário) faziam
 * `await likePost(...)` sem olhar o erro: o coração acendia, o número subia e
 * nada tinha sido salvo. O estado só voltava no próximo refetch, sem nenhuma
 * explicação pro usuário — típico de quando o RLS bloqueia (conta suspensa,
 * banida) ou a rede cai.
 *
 * @param {object}   p
 * @param {boolean}  p.liked   estado ANTES do clique
 * @param {Function} p.like    () => Promise<{ error }>
 * @param {Function} p.unlike  () => Promise<{ error }>
 * @param {Function} p.apply   aplica o estado otimista
 * @param {Function} p.revert  volta ao estado anterior
 * @returns {Promise<boolean>} true se o servidor aceitou
 */
export async function runLikeToggle({ liked, like, unlike, apply, revert }) {
  apply();
  const { error } = (liked ? await unlike() : await like()) ?? {};
  if (!error) return true;
  revert();
  toast.error(liked ? 'Não foi possível remover a curtida.' : 'Não foi possível curtir.');
  return false;
}
