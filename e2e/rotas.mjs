/**
 * Fonte única das rotas que os testes de navegador percorrem.
 *
 * Por que este arquivo existe (e é a parte importante): a lista antiga estava
 * escrita dentro do `smoke.mjs` **com quatro caminhos que não existem** —
 * `/home`, `/comunidade`, `/perfil` e `/configuracoes`. As rotas de verdade são
 * `/`, `/community`, `/profile` e `/settings`. Como todas caíam no `*` (a tela
 * de 404) e o conteúdo esperado delas era `/./` ("qualquer coisa"), o teste
 * imprimia "12/12 rotas OK" sem nunca ter aberto quatro delas. Cobertura que
 * não cobre (CLAUDE.md §1.5, fonte de silêncio nº 6).
 *
 * A trava contra isso voltar é `src/lib/__tests__/rotasE2E.test.js`: ele lê os
 * `path=` do `App.jsx` e falha se algum caminho daqui não existir lá, ou se
 * alguma rota do app não estiver coberta por nenhuma das duas listas.
 */

/** Nome de usuário usado para exercitar a rota de perfil público. */
export const PERFIL_PUBLICO = 'opedrovini';

/**
 * Visitante não logado.
 *
 * `RequireAuth` manda todo mundo para `/` (onde o guest cai na Landing), então
 * o esperado aqui **não** é o conteúdo da página interna — é o redirecionamento
 * acontecer. Fingir o contrário era o que mascarava os caminhos errados.
 */
export const ROTAS_VISITANTE = [
  { path: '/',                    nome: 'Landing',        destino: '/',      esperado: /gamerhub/i },
  { path: '/login',               nome: 'Login',          destino: '/login', esperado: /entrar|senha/i },
  { path: '/community',           nome: 'Comunidade',     destino: '/',      esperado: /gamerhub/i },
  { path: '/keys',                nome: 'Keys',           destino: '/',      esperado: /gamerhub/i },
  { path: '/profile',             nome: 'Perfil',         destino: '/',      esperado: /gamerhub/i },
  { path: '/settings',            nome: 'Configurações',  destino: '/',      esperado: /gamerhub/i },
  { path: '/admin',               nome: 'Admin',          destino: '/',      esperado: /gamerhub/i },
  { path: '/owner',               nome: 'Owner',          destino: '/',      esperado: /gamerhub/i },
  { path: '/lives',               nome: 'Lives',          destino: '/',      esperado: /gamerhub/i },
  { path: '/lives/1',             nome: 'Live por id',    destino: '/',      esperado: /gamerhub/i },
  { path: '/ranks',               nome: 'Ranks',          destino: '/',      esperado: /gamerhub/i },
  { path: `/u/${PERFIL_PUBLICO}`, nome: 'Perfil público', destino: '/',      esperado: /gamerhub/i },
  // `[29/08]` A página do projeto. Pública de propósito: alguém precisa poder
  // ler sobre o GamerHub antes de decidir criar conta — então ela tem que
  // funcionar para o VISITANTE, e é aqui que isso fica travado.
  { path: '/sobre', nome: 'Sobre', destino: '/sobre', esperado: /O GamerHub/i },
  // `[02/09]` Pública pelo mesmo motivo, e um mais forte: ninguém deveria
  // precisar criar conta para descobrir o que acontece com os dados dela.
  { path: '/privacidade', nome: 'Privacidade', destino: '/privacidade', esperado: /cookies/i },
  // Pública porque a tela de banimento aponta para cá: quem foi punido precisa
  // alcançar as regras sem estar logado.
  { path: '/regras', nome: 'Regras', destino: '/regras', esperado: /não cabe aqui/i },
  // `[02/09]` Aqui "público" É o requisito, não conveniência: quem está
  // banido, quem perdeu o acesso e quem nunca criou conta são exatamente as
  // pessoas que mais precisam falar com a equipe — e todas estão do lado de
  // fora do `RequireAuth`. Se esta rota um dia cair atrás do login, o canal
  // deixa de atender justamente quem ele existe para atender, e é este teste
  // que precisa gritar.
  { path: '/contato', nome: 'Contato', destino: '/contato', esperado: /falar com/i },
  // `[02/09]` Pública pela razão mais direta: ninguém deveria precisar criar
  // conta para ler o que está aceitando AO criar conta. Se esta rota cair
  // atrás do login, a tela de consentimento passa a linkar para o nada.
  { path: '/termos', nome: 'Termos', destino: '/termos', esperado: /do acordo/i },
  { path: '/rota-que-nao-existe', nome: '404',            destino: null,     esperado: /404|não encontrad/i },
];

/**
 * Conta logada — `role = 'user'`, que é o caso da conta de teste.
 *
 * `esperado` é conferido **dentro do `<main>`**: a Sidebar repete o nome de
 * quase toda rota no menu, então procurar "Lives" no `body` inteiro passaria
 * mesmo com a página vazia.
 */
export const ROTAS_LOGADO = [
  { path: '/',                    nome: 'Feed',           esperado: /Novo Post/i },
  { path: '/community',           nome: 'Comunidade',     esperado: /Mural da Comunidade/i },
  { path: '/keys',                nome: 'Keys',           esperado: /Promoções/i },
  { path: '/profile',             nome: 'Perfil',         esperado: /Salvar Perfil/i },
  { path: '/settings',            nome: 'Configurações',  esperado: /Zona de Perigo/i },
  { path: '/lives',               nome: 'Lives',          esperado: /Lives/i },
  { path: '/ranks',               nome: 'Ranks',          esperado: /Todos os Ranks/i },
  { path: `/u/${PERFIL_PUBLICO}`, nome: 'Perfil público', esperado: /./ },
  // `[29/08]` A página de um post, com um id que NÃO existe de propósito.
  //
  // O caminho do post encontrado já é exercitado pelo feed (é o mesmo
  // `PostCard`). O que não tinha cobertura nenhuma era o caso vazio — e ele é o
  // mais provável de quebrar em silêncio, porque "não achei" e "ainda estou
  // carregando" já foram o mesmo estado neste projeto uma vez, deixando a tela
  // girando para sempre.
  //
  // Um id fixo e inexistente torna o teste determinístico: não depende de haver
  // post nenhum no banco, nem de qual.
  { path: '/post/00000000-0000-0000-0000-000000000000', nome: 'Post por id',
    esperado: /não existe ou não está visível/i },
  // Mesma lógica para o mural, que ganhou página própria em 29/08.
  { path: '/mural/00000000-0000-0000-0000-000000000000', nome: 'Mural por id',
    esperado: /não existe ou não está visível/i },
  // A tela de 404 é a única rota renderizada FORA do `Layout` (App.jsx): não
  // tem Sidebar, Header nem `<main>`. Procurar dentro de `<main>` ali dá
  // timeout com a tela correta na frente — foi o que aconteceu no primeiro CI.
  { path: '/rota-que-nao-existe', nome: '404', esperado: /404|não encontrad/i,
    foraDoLayout: true },
];

/**
 * Rotas de staff vistas por uma conta comum. Não é sweep de renderização: é
 * checagem de permissão num navegador de verdade. `Admin` redireciona para `/`
 * e `Owner` renderiza vazio — nos dois casos, nada de painel pode aparecer.
 */
export const ROTAS_PROIBIDAS_PARA_USUARIO = [
  { path: '/admin', nome: 'Admin' },
  { path: '/owner', nome: 'Owner' },
];

/** Marcas de conteúdo de staff que jamais podem aparecer para `role = 'user'`. */
export const MARCAS_DE_PAINEL = [
  /Área restrita/i,
  /Fila de moderação/i,
  /Logs de auditoria/i,
];

/**
 * Rotas que o E2E **não** cobre, com o motivo — não é lapso, é declaração.
 *
 * A lista existe para o teste de contrato poder exigir cobertura de todo o
 * resto sem virar mentira: sem ela, a saída honesta seria afrouxar o contrato,
 * e aí ele deixaria de pegar o próximo caminho esquecido.
 */
export const ROTAS_SEM_COBERTURA_E2E = {
  '/auth/confirm':
    'exige um token de uso único vindo do email; abrir a rota sem ele só '
    + 'exercita a tela de erro, e o resultado depende de quanto tempo o '
    + 'redirecionamento automático leva — teste instável, cobertura falsa.',
};
