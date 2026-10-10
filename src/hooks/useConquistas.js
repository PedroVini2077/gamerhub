import { useEffect, useState } from 'react';

import { registrarConquistas, lerConquistasDesbloqueadas } from '../services/conquistasService';

/**
 * `[10/10]` O registro de desbloqueio das conquistas da pessoa logada.
 *
 * ── A ORDEM importa, e é a razão de ser um hook e não duas chamadas ─────────
 *
 * Registrar vem ANTES de ler. Invertido, a conquista que acabou de ser cumprida
 * apareceria concluída e sem data nesta visita, ganhando data só na próxima —
 * e isso é indistinguível de um registro que falhou.
 *
 * ── Quanto isso custa (§0.2) ────────────────────────────────────────────────
 *
 * Uma ida de escrita e uma de leitura por visita ao PRÓPRIO perfil. A escrita
 * só grava o que ainda não tem registro: depois da primeira vez ela devolve 0
 * e não toca em nada. Não multiplica por post, curtida nem leitor — este card
 * vive atrás de `RequireAuth`, em `/perfil`, e ninguém vê o de outra pessoa.
 *
 * ── A guarda de cancelamento não é enfeite ──────────────────────────────────
 *
 * São duas idas ao banco em série. Sem a guarda, sair da tela no meio deixa a
 * resposta velha chamar `setState` num componente desmontado — e, pior, trocar
 * de conta deixaria o registro de uma aparecer na outra (é a classe que o
 * `cacheNaoAtravessaTrocaDeConta` vigia).
 *
 * ── Falhar aqui NÃO pode derrubar o card ────────────────────────────────────
 *
 * O progresso das conquistas é derivado e não depende desta tabela. Se o
 * registro falhar, o card continua inteiro e só não mostra data — então o
 * estado inicial é `{}` e não `null`, para a tela nunca ficar esperando.
 */
export function useConquistas(userId) {
  const [desbloqueadas, setDesbloqueadas] = useState({});

  useEffect(() => {
    if (!userId) return;

    let cancelado = false;
    (async () => {
      // O retorno de `registrarConquistas` é ignorado de propósito: quantas
      // entraram é informação para quem testa (ela está no corpo da resposta,
      // §1.5), não para a tela. A tela aprende o resultado pela leitura abaixo.
      await registrarConquistas();
      if (cancelado) return;

      const { data } = await lerConquistasDesbloqueadas();
      if (cancelado) return;
      setDesbloqueadas(data ?? {});
    })();

    return () => { cancelado = true; };
    // Depende do ID e não do objeto `user`, pelo mesmo motivo do
    // `useProfileStats`: o poll de sessão devolve objeto novo a cada 20s.
  }, [userId]);

  return desbloqueadas;
}
