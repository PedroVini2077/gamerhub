/**
 * O que o `MediaError` de um `<video>` realmente diz.
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 *
 * A primeira versão do aviso de falha de vídeo mandava UMA frase para os quatro
 * erros possíveis: "o navegador não decodificou o arquivo". O dono postou, o
 * aviso apareceu com essa frase, e ela **podia não ser verdade** — porque o
 * código chamava `video.load()` depois de já ter atribuído `src`, e isso aborta
 * a carga em andamento. Um `MEDIA_ERR_ABORTED` era relatado como problema de
 * codec.
 *
 * Mensagem de erro que mente é pior do que "erro desconhecido": ela manda
 * investigar o lugar errado por horas (`CLAUDE.md` §1.5). Os quatro códigos
 * têm correções completamente diferentes:
 *
 * | Código | O que aconteceu | Onde procurar |
 * | --- | --- | --- |
 * | 1 `ABORTED` | alguém cancelou a carga | o nosso próprio código |
 * | 2 `NETWORK` | a fonte sumiu no meio | a URL, o blob revogado, a rede |
 * | 3 `DECODE` | o arquivo chegou e o decodificador recusou | arquivo corrompido |
 * | 4 `SRC_NOT_SUPPORTED` | o formato/codec não é suportado | HEVC, container exótico |
 */

const NOMES = {
  1: 'MEDIA_ERR_ABORTED (a carga foi cancelada)',
  2: 'MEDIA_ERR_NETWORK (a fonte falhou no meio do caminho)',
  3: 'MEDIA_ERR_DECODE (o decodificador recusou o conteúdo)',
  4: 'MEDIA_ERR_SRC_NOT_SUPPORTED (formato ou codec não suportado)',
};

/**
 * @param {MediaError|null|undefined} erro o `video.error`
 * @returns {string} descrição fechada; código desconhecido aparece como tal em
 *   vez de virar um dos quatro por engano (§4, nada de fallback silencioso).
 */
export function descreverErroDeMidia(erro) {
  if (!erro) return 'sem MediaError (o navegador não disse o motivo)';
  const nome = NOMES[erro.code] ?? `código desconhecido ${erro.code}`;
  const detalhe = erro.message?.trim();
  return detalhe ? `${nome}: ${detalhe}` : nome;
}
