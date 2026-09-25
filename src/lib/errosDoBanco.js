/**
 * `[26/09]` O erro do Postgres vira PORTUGUÊS antes de chegar na tela.
 *
 * ── O que aconteceu, e por que a correção é de CLASSE ─────────────────────
 *
 * Ele clicou em "Publicar" numa matéria sem corpo e a tela mostrou isto,
 * inteiro, em inglês, embaixo dos botões:
 *
 *     new row for relation "news_articles" violates check constraint
 *     "news_articles_corpo_exigido_no_ar"
 *
 * A informação está **certa** — a §1.5 proíbe engolir o erro, e engolir não é
 * a saída. O problema é que ela chega em forma inutilizável: quem lê não sabe
 * o que fazer, e o nome da constraint é vocabulário de quem escreveu o banco.
 *
 * Consertar só essa mensagem seria consertar o CASO. Existem
 * **64 constraints** neste banco (51 CHECK + 13 UNIQUE, medidas em 26/09), e
 * qualquer uma delas produz exatamente a mesma tela feia. Então o conserto
 * mora aqui, num lugar só, e o `from()`/`fromCount()` de `services/result.js`
 * passam TODO erro de escrita por ele — nenhum service precisa lembrar.
 *
 * ── A fronteira, e ela é o que impede este arquivo de estragar coisa boa ──
 *
 * Só é traduzido o que é **máquina**: violação de constraint, privilégio
 * negado, FK, nulo, texto longo demais. O `RAISE EXCEPTION` das nossas
 * próprias RPCs (código `P0001`) **passa intacto** — essas mensagens já são
 * escritas em português para o toast do usuário, de propósito
 * (`docs/regras/BANCO.md`), e traduzi-las de novo seria apagar a frase boa.
 *
 * ── Nada é perdido ────────────────────────────────────────────────────────
 *
 * O texto original continua no campo `tecnico`, e a tela o mostra atrás de um
 * "detalhes". Trocar o erro por uma frase genérica **sem guardar o original**
 * seria a outra metade do §1.5: a informação existe e some no caminho.
 */

/**
 * As regras do banco que a TELA consegue esbarrar, com a frase que ensina o
 * que fazer. Chave = nome da constraint, exatamente como o Postgres o escreve.
 *
 * **Mapa explícito, e o desconhecido NÃO cai num palpite** (§4): o que não
 * está aqui recebe a frase honesta de `porForma`, que diz que a regra existe
 * e a nomeia — em vez de inventar um motivo.
 */
export const REGRAS = {
  // ── GamerHub News ──
  news_articles_corpo_exigido_no_ar:
    'Para publicar ou agendar, a matéria precisa do corpo escrito. '
    + 'Rascunho pode ficar sem texto; no ar, não.',
  news_articles_publicado_tem_data:  'Matéria publicada precisa da data de publicação.',
  news_articles_agendado_tem_data:   'Matéria agendada precisa da data do agendamento.',
  news_articles_slug_unico:          'Já existe uma matéria com este endereço. Mude o título.',
  news_articles_slug_formato:        'O título precisa ter letras ou números para virar um endereço.',
  news_articles_titulo_nao_vazio:    'A matéria precisa de um título.',
  news_articles_editoria:            'Editoria desconhecida. Escolha uma da lista.',
  news_articles_status:              'Estado desconhecido para uma matéria.',
  news_articles_capa_http:           'O endereço da capa precisa começar com https://',
  news_articles_fonte_url_http:      'O endereço da fonte precisa começar com https://',
  news_sources_url_http:             'O endereço da fonte precisa começar com https://',
  news_sources_url_unica:            'Esta fonte já está cadastrada.',
  news_sources_nome_nao_vazio:       'A fonte precisa de um nome.',
  news_tags_slug_unico:              'Já existe uma tag com este endereço.',
  news_tags_nome_nao_vazio:          'A tag precisa de um nome.',
  news_tags_slug_formato:            'O nome da tag precisa ter letras ou números.',
  news_sources_tipo:                 'Tipo de fonte desconhecido (site, rss ou api).',
  news_items_raw_url_unica:          'Este link já foi coletado antes.',

  // ── Feed, mural e mídia ──
  posts_embed_url_http_only:         'O link do vídeo precisa começar com https://',
  post_media_url_http_only:          'O endereço da mídia precisa começar com https://',
  post_media_type_check:             'Tipo de mídia não aceito.',
  cpm_url_http_only:                 'O endereço da mídia precisa começar com https://',
  post_likes_post_id_user_id_key:    'Você já curtiu este post.',
  comment_likes_comment_id_user_id_key: 'Você já curtiu este comentário.',
  // Chave composta que existe só para uma FK apontar para ela. A tela não
  // alcança — mas a frase fica, porque "não alcança hoje" já virou bug antes.
  comments_id_post_id_key:           'Este comentário já existe neste post.',
  community_post_likes_post_id_user_id_key: 'Você já curtiu este recado.',

  // ── Live ──
  posts_live_duracao_faixa:          'A duração da live está fora da faixa aceita.',
  posts_live_no_ar_nao_tem_fim:      'Live no ar não pode ter horário de encerramento.',
  posts_live_oculta_nao_fica_no_ar:  'Live oculta pela moderação não pode voltar ao ar.',
  posts_live_apagada_nao_fica_no_ar: 'Live de post apagado não pode voltar ao ar.',
  lives_realizadas_fim_depois_do_inicio: 'O fim da live não pode ser antes do início.',
  posts_live_kind_check:             'Tipo de live desconhecido.',
  posts_live_kind_label_check:       'O rótulo do tipo de live não combina com o tipo escolhido.',
  live_muted_post_id_user_id_key:    'Esta pessoa já está silenciada nesta live.',
  live_chat_timeouts_post_id_user_id_key: 'Esta pessoa já está de castigo nesta live.',

  // ── Perfil e conta ──
  profiles_username_key:             'Este nome de usuário já está em uso.',
  profiles_tamanhos_razoaveis:       'Algum campo do perfil passou do tamanho permitido.',
  profiles_redes_sao_handles:        'Rede social: informe só o @ ou o nome de usuário, não o link inteiro.',
  profiles_role_check:               'Cargo desconhecido.',
  check_platform:                    'Plataforma desconhecida. Escolha uma da lista.',
  check_playstyle:                   'Estilo de jogo desconhecido. Escolha um da lista.',
  policy_acceptances_unico:          'Você já aceitou esta versão deste documento.',
  policy_acceptances_documento_check: 'Documento legal desconhecido.',
  policy_acceptances_versao_check:   'A versão do documento está fora do formato esperado.',

  // ── Moderação e equipe ──
  blocked_words_word_key:            'Esta palavra já está na lista.',
  blocked_words_severity_check:      'Severidade desconhecida.',
  moderation_queue_status_check:     'Estado desconhecido para um item da fila.',
  moderation_queue_trigger_type_check: 'Origem desconhecida para um item da fila.',
  reports_reason_check:              'Motivo de denúncia desconhecido.',
  reports_content_type_check:        'Tipo de conteúdo desconhecido para uma denúncia.',
  reports_status_check:              'Estado desconhecido para uma denúncia.',
  violations_points_faixa:           'A pontuação da infração está fora da faixa aceita.',
  violations_action_taken_check:     'Ação de moderação desconhecida.',
  unban_requests_status_check:       'Estado desconhecido para um pedido de desbanimento.',
  live_reactivation_requests_status_check: 'Estado desconhecido para um pedido de reativação.',
  staff_nominations_status_check:    'Estado desconhecido para uma indicação.',
  staff_nominations_target_role_check: 'Cargo desconhecido para uma indicação.',
  staff_nominations_trial_max_365d:  'O estágio não pode passar de 365 dias.',
  role_change_requests_status_check: 'Estado desconhecido para um pedido de cargo.',
  admin_notifications_audience_check: 'Público desconhecido para o aviso.',

  // ── Contato e chaves ──
  contact_messages_status_check:     'Estado desconhecido para uma mensagem.',
  contact_messages_subject_check:    'Assunto desconhecido. Escolha um da lista.',
  contact_messages_reply_len:        'A resposta está fora do tamanho permitido.',
  game_keys_promo_url_http_only:     'O link da promoção precisa começar com https://',
};

/** O nome da constraint, tirado do texto que o Postgres devolve. */
function nomeDaRegra(bruto) {
  return bruto.match(/constraint\s+"([^"]+)"/i)?.[1]
      ?? bruto.match(/violates unique constraint\s+"([^"]+)"/i)?.[1]
      ?? null;
}

/**
 * A frase por FORMA do erro, quando a regra específica não está no mapa.
 *
 * Ela **não inventa o motivo** — diz o que aconteceu, nomeia a regra para
 * quem for investigar, e admite que a tela ainda não sabe explicar aquela.
 * Mensagem errada custa mais do que mensagem genérica (§1.5).
 */
const POR_FORMA = {
  23514: (regra) => regra
    ? `O banco recusou: esta informação não passa na regra "${legivel(regra)}".`
    : 'O banco recusou: alguma informação não passa numa regra de validação.',
  23505: (regra) => regra
    ? `Já existe um registro com este valor (${legivel(regra)}).`
    : 'Já existe um registro com este valor.',
  23503: () => 'Isto aponta para algo que não existe mais. Recarregue a página.',
  23502: () => 'Faltou preencher um campo obrigatório.',
  22001: () => 'Algum campo passou do tamanho permitido.',
  '22P02': () => 'Algum valor chegou num formato que o banco não entende.',
  42501: () => 'Você não tem permissão para isto.',
  '23P01': () => 'Isto conflita com um registro que já existe.',
};

/** `news_articles_corpo_exigido_no_ar` -> `corpo exigido no ar`. */
function legivel(regra) {
  return regra.replace(/_/g, ' ');
}

/**
 * Traduz o erro do banco para a tela, **sem perder o original**.
 *
 * @param {object|null} error  o erro como o supabase-js devolve
 * @returns {object|null} o mesmo erro, com `message` em português e o texto
 *                        original guardado em `tecnico`
 */
export function humanizarErroDoBanco(error) {
  if (!error) return error;
  const bruto = String(error.message ?? '');
  const code = String(error.code ?? '');

  // `P0001` é `RAISE EXCEPTION` das NOSSAS funções: a frase já foi escrita
  // para uma pessoa ler. Traduzir de novo apagaria a boa.
  if (code === 'P0001' || !bruto) return error;

  const regra = nomeDaRegra(bruto);
  const doMapa = regra ? REGRAS[regra] : null;
  const porForma = POR_FORMA[code];

  // Nada reconhecido: devolve intacto. Inventar frase para erro que eu não
  // identifiquei seria trocar informação verdadeira por chute.
  if (!doMapa && !porForma) return error;

  return {
    ...error,
    message: doMapa ?? porForma(regra),
    tecnico: bruto,
    regra,
  };
}
