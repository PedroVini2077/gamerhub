-- BUG QUE ELE ACHOU NO PAINEL, minutos depois de eu entregar:
--
--   null value in column "conteudo" of relation "news_articles"
--   violates not-null constraint
--
-- Criar rascunho estava QUEBRADO. Não dava para escrever uma matéria pelo site.
--
-- A CAUSA, e ela é de DESENHO, não de digitação. `conteudo` nasceu `NOT NULL`
-- com `CHECK (length(btrim(conteudo)) > 0)` — ou seja, a tabela exigia o corpo
-- **no instante da criação**. Mas um rascunho, por definição, é o artigo ANTES
-- de ter corpo: o título existe, a editoria existe, e o texto é o que a pessoa
-- vai escrever a seguir.
--
-- Quem estava errado era o schema, não o painel. A alternativa — o painel
-- mandar um corpo de mentira ("escreva aqui") — seria pior: texto placeholder
-- que passa no CHECK é texto que um dia vai ao ar por esquecimento.
--
-- COMO EU DEIXEI PASSAR. Eu testei o caminho de leitura em ROLLBACK inserindo
-- artigos COM `conteudo`, e testei o corte editorial COM `conteudo`. Nunca
-- rodei o INSERT exato que `criarRascunho` faz. É o §1.2 na letra: eu provei o
-- caminho que eu tinha na cabeça, não o que o código executa.
--
-- A REGRA CERTA: o corpo é exigido quando o artigo VAI AO AR, não quando ele
-- nasce. É a mesma forma do `news_articles_publicado_tem_data`, que já existia
-- ao lado e que eu podia ter copiado desde o começo.
--
-- PROVADO EM ROLLBACK, papel real, 6 de 6:
--   rascunho sem corpo ..... criou       publicar sem corpo ..... bloqueado
--   revisão sem corpo ...... deixou      agendar sem corpo ...... bloqueado
--   publicar com corpo ..... publicou    esvaziar o que está no ar . bloqueado
--
-- As duas últimas linhas são ganho que eu não tinha planejado: a mesma
-- condição que libera o rascunho impede que alguém **esvazie** uma matéria que
-- já está sendo lida.
--
-- Por que `in_review` NÃO exige corpo: mandar para revisão um texto pela metade
-- é pedido de ajuda legítimo ("olha se o ângulo está certo"). Quem decide se
-- está pronto é quem publica, e aí o CHECK cobra.

ALTER TABLE news_articles ALTER COLUMN conteudo DROP NOT NULL;

ALTER TABLE news_articles DROP CONSTRAINT news_articles_conteudo_nao_vazio;

ALTER TABLE news_articles ADD CONSTRAINT news_articles_corpo_exigido_no_ar
  CHECK (status NOT IN ('published','scheduled')
         OR length(btrim(coalesce(conteudo,''))) > 0);
