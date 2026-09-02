import { useEffect, useState } from 'react';
import { useAuth } from './useAuth.jsx';
import { meusAceites, registrarAceiteDosDocumentos } from '../services/aceiteService';
import { documentosPendentes, aceitesParaGravar } from '../lib/documentosLegais';

/**
 * Quais documentos esta pessoa ainda precisa aceitar — e a ação de aceitar.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * O aceite no cadastro cobre quem se cadastrar de 02/09 em diante. Faltavam
 * dois casos, e são o mesmo mecanismo:
 *
 *   1. as contas criadas ANTES, que não têm registro nenhum;
 *   2. qualquer pessoa, no dia em que um documento mudar de versão.
 *
 * ── Avisa, não bloqueia ─────────────────────────────────────────────────────
 *
 * Decisão do dono: *"só avisa sem bloquear"*. E ela é a correta: um modal que
 * trava o site força a pessoa a clicar em "aceito" para conseguir **ler** o
 * documento que está aceitando. Consentimento arrancado assim é pior do que
 * nenhum — vale menos juridicamente e é hostil na prática.
 *
 * ── Por que o estado guarda o DONO dos dados ────────────────────────────────
 *
 * `{ userId, aceites }` num objeto só, e o resultado derivado no render.
 *
 * A primeira versão guardava só `pendentes` e fazia `setPendentes(null)` no
 * corpo do efeito quando não havia sessão — o lint reclamou com razão. E o
 * conserto não era calar o lint: guardar de QUEM são os dados resolve o
 * problema de verdade, porque uma resposta que chega depois de a sessão mudar
 * passa a ser reconhecível como velha, em vez de ser aplicada à pessoa errada.
 *
 * ── Uma consulta por sessão, e o motivo ────────────────────────────────────
 *
 * A pergunta não muda enquanto a pessoa navega: as versões são constantes do
 * código, e o aceite dela só muda quando ela clica. Refazer a consulta a cada
 * tela seria egress recorrente por uma resposta que já está em mãos (§6.1).
 */
export function useAceitesPendentes() {
  const { user } = useAuth();
  const [dados, setDados] = useState({ userId: null, aceites: null });
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const id = user?.id;
    if (!id) return undefined;
    let vivo = true;
    meusAceites().then(({ data, error }) => {
      if (!vivo) return;
      // Erro NÃO vira "tudo pendente": a rede caiu, e cutucar quem já aceitou
      // por causa disso é alarme falso — o tipo que ensina a ignorar o canal
      // (§0.2, 4ª regra). `aceites: null` faz `documentosPendentes` devolver
      // `null`, que a tela lê como "não sei" e não mostra nada.
      setDados({ userId: id, aceites: error ? null : data });
    });
    return () => { vivo = false; };
  }, [user?.id]);

  // Derivado, e não estado: se a sessão trocar, os dados do dono anterior
  // deixam de valer sozinhos, sem ninguém precisar lembrar de limpá-los.
  const pendentes = dados.userId && dados.userId === user?.id
    ? documentosPendentes(dados.aceites)
    : null;

  async function aceitar() {
    const id = user?.id;
    if (!id) return { error: new Error('Sem sessão.') };
    setEnviando(true);
    const resultado = await registrarAceiteDosDocumentos(id);
    setEnviando(false);
    // Só some da tela se o banco confirmou. Sumir com erro faria a pessoa
    // pensar que aceitou sem ter aceitado — e do nosso lado, sem registro
    // nenhum. É o §1.5: a tela não pode dizer o que não aconteceu.
    // Reaproveita `aceitesParaGravar` — é exatamente a lista que acabou de ser
    // escrita, e o `upsert` só devolve sucesso quando as linhas passaram a
    // existir. Evita uma segunda ida ao banco para confirmar o que a própria
    // escrita já garantiu, e não cria uma segunda cópia das versões (§4).
    if (!resultado.error) setDados({ userId: id, aceites: aceitesParaGravar(id) });
    return resultado;
  }

  return { pendentes, aceitar, enviando };
}
