import { supabase } from '../lib/supabase';
import { ok, fail, from, fromCount } from './result';
import { slugificar, slugValido } from '../lib/news/slug';
import { estadoNoAr } from '../lib/news/estadosDoArtigo';

/**
 * `[25/09]` O News pelo lado de QUEM ESCREVE.
 *
 * ── A segurança NÃO está aqui ─────────────────────────────────────────────
 *
 * Quem impede é o banco: a RLS decide quem escreve na tabela, e o trigger
 * `news_guarda_a_publicacao` levanta exceção quando alguém que não é super
 * admin tenta publicar, agendar, ou mexer no que já está no ar. O site usa a
 * `anon key` — qualquer pessoa chama a REST API e pula este arquivo inteiro.
 *
 * O que está aqui é a **conversa com o servidor**.
 *
 * ── `[26/09]` A tradução do erro NÃO mora mais aqui ───────────────────────
 *
 * Este arquivo tinha um `traduzir()` próprio com três constraints escritas à
 * mão. Ele cobria três de **64** — e a que o dono esbarrou (`corpo exigido no
 * ar`) não era nenhuma das três: o Postgres cru apareceu na tela. Hoje quem
 * traduz é `lib/errosDoBanco.js`, chamado pelo `fail()` de `result.js`, então
 * vale para todo service de uma vez.
 *
 * ── `count: 'exact'` em toda escrita, e o motivo é velho ──────────────────
 *
 * RLS nega com **0 linhas e nenhum erro**. Sem conferir a contagem, a tela diz
 * "salvo" e nada aconteceu — foi exatamente isso que escondeu, por meses, a
 * moderação de comentário nunca ter funcionado.
 */

/** O que o painel lista. Sem `conteudo`: a lista não precisa do corpo. */
const COLUNAS_DO_PAINEL =
  'id, slug, titulo, editoria, status, publicado_em, agendado_para, updated_at, autor_id, '
  + 'redigido_com_ia';

/**
 * Todos os artigos que a equipe enxerga — rascunho, revisão, no ar, arquivado.
 *
 * A RLS já entrega só para `is_staff()`: para quem não é, isto devolve os
 * publicados, e o painel nem é alcançável. Não há filtro de papel aqui de
 * propósito — duplicá-lo criaria um segundo lugar para errar.
 */
export async function fetchArtigosDaEquipe() {
  return from(
    await supabase.from('news_articles').select(COLUNAS_DO_PAINEL)
      .order('updated_at', { ascending: false })
      .limit(100),
    [],
  );
}

/** Um artigo inteiro, para editar. */
export async function fetchArtigoParaEditar(id) {
  if (!id) return ok(null);
  return from(
    await supabase.from('news_articles').select('*').eq('id', id).maybeSingle(),
    null,
  );
}

/**
 * Cria um rascunho.
 *
 * O slug sai do título e é conferido AQUI. Título que não produz slug (só
 * emoji, só pontuação) é recusado com uma frase em português, em vez de virar
 * `violates check constraint` na cara de quem escreveu.
 */
export async function criarRascunho({ titulo, editoria, autorId, fonteUrl = null }) {
  const slug = slugificar(titulo);
  if (!slugValido(slug)) {
    return fail({ message: 'O título precisa ter letras ou números para virar um endereço.' });
  }

  return from(
    await supabase.from('news_articles')
      .insert({
        titulo: titulo.trim(), slug, editoria, status: 'draft', autor_id: autorId,
        // `[26/09]` Vem preenchida quando o rascunho nasce de uma pauta do
        // radar: a fonte é o endereço do feed que a sustentou, e perdê-la aqui
        // obrigaria o editor a ir buscar de novo o link que ele acabou de ver.
        fonte_url: fonteUrl,
      })
      .select(COLUNAS_DO_PAINEL).single(),
    null,
  );
}

/** Salva o texto. Não mexe em `status` — mudar de estado é a função abaixo. */
export async function salvarArtigo(id, campos) {
  const { count, error } = await supabase.from('news_articles')
    .update({ ...campos, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', id);

  if (error) return fail(error);
  return fromCount({ count }, 'Nada foi salvo. Este artigo já está no ar? Só super admin edita o que está publicado.');
}

/**
 * Leva o artigo a outro estado.
 *
 * `publicado_em` é preenchido AQUI ao publicar, porque o banco tem um `CHECK`
 * que exige a data quando o status é `published`. Deixar isso para a tela faria
 * o editor descobrir a regra por uma constraint.
 */
export async function mudarEstado(id, destino) {
  const campos = { status: destino, updated_at: new Date().toISOString() };
  if (destino === 'published') campos.publicado_em = new Date().toISOString();

  const { count, error } = await supabase.from('news_articles')
    .update(campos, { count: 'exact' })
    .eq('id', id);

  if (error) return fail(error);
  return fromCount({ count }, 'Nada mudou. Você tem permissão para este estado?');
}

/** Apaga. Só super admin e owner passam pela RLS. */
export async function apagarArtigo(id) {
  const { count, error } = await supabase.from('news_articles')
    .delete({ count: 'exact' }).eq('id', id);

  if (error) return fail(error);
  return fromCount({ count }, 'Nada foi apagado — apagar artigo é de super admin e owner.');
}

/** Reexportado para a tela não precisar conhecer dois módulos. */
export { estadoNoAr };
