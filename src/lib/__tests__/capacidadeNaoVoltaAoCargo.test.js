import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { varrerFontes } from './varrerFontes';
import { CAPACIDADES, CAPACIDADES_CONHECIDAS, podeComOPapel } from '../capacidades';
import { roleRank, canModerate } from '../roles';

/**
 * `[01/10]` Capacidade não volta a ser comparação de cargo espalhada na UI.
 *
 * ── O que esta trava proíbe, e SÓ isso ────────────────────────────────────
 *
 * O padrão `{isAdmin && <Controle />}` — **renderizar um controle** a partir de
 * uma bandeira de cargo. É a forma que espalha a regra: para saber quem publica
 * matéria era preciso abrir o painel editorial; para saber quem bane, o painel
 * de usuários. Eram **114 usos em 31 arquivos** em 01/10.
 *
 * ── O que ela NÃO proíbe, de propósito ────────────────────────────────────
 *
 * | Continua permitido | Por quê |
 * | --- | --- |
 * | `<RoleBadge role={role} />` | identidade, não capacidade |
 * | `roleRank(...)`, `canModerate(viewer, alvo)` | **hierarquia entre duas pessoas** — booleano de uma pessoa não expressa |
 * | `canModerateLive(isAdmin, live, user)` | depende do OBJETO |
 * | `if (!isAdmin) navigate('/')` | gate de ROTA é posição: "é da equipe" |
 * | `isSuperAdmin` descendo como prop | quem o recebe pode estar fazendo hierarquia |
 *
 * **Regex burro quebraria todos os cinco.** Por isso o alvo é estreito: só o
 * `{bandeira && <Componente` dentro de JSX, que é inequivocamente "mostrar um
 * controle por causa do cargo".
 *
 * ── A lista de isenções exige MOTIVO ──────────────────────────────────────
 *
 * Não é lista de arquivos tolerados: cada linha explica por que aquele uso é
 * identidade ou hierarquia. Isenção sem motivo escrito é como a trava morre.
 */

const PASTAS = ['src/components', 'src/pages'];

/**
 * `{... isAdmin ... && <X` — mostrar CONTROLE por bandeira de cargo.
 *
 * A primeira versão exigia a bandeira **logo depois** do `{`, e por isso
 * `{user.banned && isSuperAdmin && (<Botao/>)}` passava batido — o mesmo
 * padrão proibido, só com a ordem dos operandos trocada. Trava com buraco
 * conhecido é pior do que trava nenhuma (§1.5), então o alvo agora é a
 * expressão JSX inteira, numa linha só.
 */
const PROIBIDO = /\{[^{}\n]*\b(isAdmin|isSuperAdmin|isOwner|ehSuper)\b[^{}\n]*&&\s*\(?\s*</g;

/**
 * Isenções, cada uma com o motivo. Chave = caminho; valor = por quê.
 *
 * A migração de 01/10 deixou **uma**, e ela é de identidade — o cartão que
 * escreve "Fundador — Criador da plataforma". Capacidade nenhuma passa por ali.
 *
 * (Houve um segundo achado, e ele virou conserto em vez de isenção: o
 * `PostCard` chamava de `isOwner` o "sou o autor DESTE post", colidindo com o
 * `isOwner` do `useRole`, que é "sou o fundador". Virou `souOAutor`.)
 */
const ISENCOES = {
  'src/components/profile/PlayerStatsCard.jsx':
    'IDENTIDADE, nao capacidade: o `isOwner` aqui pinta a borda do cartao e '
    + 'escreve o rotulo "Fundador — Criador da plataforma". E apresentacao de '
    + 'quem a pessoa E, que o plano de 24/09 manda explicitamente manter em '
    + '`role`. Nenhum controle e liberado por este booleano.',
  'src/components/ui/AvatarPopup.jsx':
    'IDENTIDADE: escreve o rotulo "Fundador" no lugar do rank e esconde a '
    + 'barra de XP de quem esta fora do sistema de XP. E apresentacao de quem '
    + 'a pessoa E — nenhum controle, nenhuma acao.',
  'src/pages/Ranks.jsx':
    'IDENTIDADE: o fundador nao participa do ranking de XP, entao a pagina '
    + 'mostra um painel diferente para ele. A decisao e sobre a POSICAO dele '
    + 'na hierarquia, nao sobre uma capacidade — nao ha botao nem acao.',
};

describe('a UI não decide capacidade por cargo', () => {
  it('nenhum controle é mostrado por bandeira de cargo', () => {
    const arquivos = PASTAS.flatMap((p) => varrerFontes(p, { extensoes: /\.jsx$/ }));
    expect(arquivos.length, 'nao varri arquivo nenhum').toBeGreaterThan(50);

    const infratores = [];
    for (const caminho of arquivos) {
      if (caminho in ISENCOES) continue;
      // A prosa sai antes: o comentário que explica a migração cita o padrão.
      const codigo = readFileSync(caminho, 'utf8')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      const achados = [...codigo.matchAll(PROIBIDO)].map((m) => m[1]);
      if (achados.length) infratores.push(`${caminho} -> {${achados.join(', ')} && <...`);
    }

    expect(infratores, 'estes lugares voltaram a MOSTRAR UM CONTROLE por causa do '
      + 'cargo:\n\n'
      + `  ${infratores.join('\n  ')}\n\n`
      + '  A pergunta certa nao e "qual e o cargo dele" — e "ele pode fazer\n'
      + '  isto". Use `can(\'<capacidade>\')` do `usePermissions`, e o cargo\n'
      + '  minimo fica num lugar so (src/lib/capacidades.js).\n\n'
      + '  Se o uso for IDENTIDADE (badge, cor, rotulo) ou HIERARQUIA entre duas\n'
      + '  pessoas (`canModerate`), ele e legitimo — acrescente em `ISENCOES`\n'
      + '  COM O MOTIVO escrito. Isencao sem motivo e como a trava morre.')
      .toEqual([]);
  });

  it('toda isenção tem motivo escrito', () => {
    const semMotivo = Object.entries(ISENCOES)
      .filter(([, motivo]) => !motivo || motivo.trim().length < 20)
      .map(([caminho]) => caminho);
    expect(semMotivo).toEqual([]);
  });
});

describe('o mapa de capacidades é honesto', () => {
  it('toda capacidade diz ONDE o banco a protege de verdade', () => {
    // Esta e a coluna que importa. Capacidade sem protecao no banco e
    // decoracao: o botao some para quem nao pode, e quem chamar a REST API
    // direto faz a operacao assim mesmo.
    const decorativas = CAPACIDADES_CONHECIDAS
      .filter((c) => !CAPACIDADES[c].protecaoNoBanco?.trim());
    expect(decorativas, 'estas capacidades nao dizem onde o banco as protege.\n'
      + '  `can()` e EXPERIENCIA, nao seguranca: o site usa a anon key e\n'
      + '  qualquer um pula o frontend. Se a operacao nao tem policy, RPC ou\n'
      + '  constraint atras dela, o problema e no banco — nao se resolve\n'
      + '  escondendo o botao.').toEqual([]);
  });

  it('o mapa guarda RANK, nunca lista de cargos', () => {
    // Lista literal de papeis e o bug que o banco ja teve TRES vezes: alguem
    // acrescenta um cargo e esquece uma lista. Aqui o rank deriva do
    // `ROLE_RANK`, que e fonte unica com o `role_rank()` do Postgres.
    for (const [nome, regra] of Object.entries(CAPACIDADES)) {
      expect(typeof regra.rankMinimo, `${nome} nao guarda rankMinimo numerico`).toBe('number');
      expect(regra.cargos, `${nome} ganhou uma LISTA de cargos`).toBeUndefined();
    }
  });
});

describe('as regras de verdade, provadas', () => {
  it('usuário comum não tem capacidade nenhuma', () => {
    for (const c of CAPACIDADES_CONHECIDAS) {
      expect(podeComOPapel('user', c), `usuario comum passou em ${c}`).toBe(false);
    }
  });

  it('admin modera, mas NÃO publica matéria nem mexe em cargo', () => {
    // A decisao dele de 25/09, saida B: admin ESCREVE, super admin PUBLICA.
    expect(podeComOPapel('admin', 'moderate_content')).toBe(true);
    expect(podeComOPapel('admin', 'manage_news')).toBe(true);
    expect(podeComOPapel('admin', 'publish_news')).toBe(false);
    expect(podeComOPapel('admin', 'manage_roles')).toBe(false);
    expect(podeComOPapel('admin', 'manage_site')).toBe(false);
  });

  it('super admin publica e mexe em cargo, mas NÃO configura o site', () => {
    expect(podeComOPapel('super_admin', 'publish_news')).toBe(true);
    expect(podeComOPapel('super_admin', 'manage_roles')).toBe(true);
    expect(podeComOPapel('super_admin', 'manage_site')).toBe(false);
  });

  it('owner tem todas — e isso é derivado do rank, não escrito à mão', () => {
    for (const c of CAPACIDADES_CONHECIDAS) {
      expect(podeComOPapel('owner', c), `owner reprovou em ${c}`).toBe(true);
    }
  });

  it('capacidade desconhecida ESTOURA em vez de devolver false', () => {
    // Um typo que devolvesse `false` esconderia o controle para todo mundo,
    // em silencio, para sempre (§1.5, 5a fonte).
    expect(() => podeComOPapel('owner', 'publsh_news')).toThrow(/Capacidade desconhecida/);
  });

  it('a HIERARQUIA continua separada, e capacidade não a substitui', () => {
    // admin NAO modera admin — `>` estrito. Nenhum booleano de uma pessoa so
    // expressa isso, e e por isso que `canModerate` nao foi achatado.
    expect(podeComOPapel('admin', 'moderate_content')).toBe(true);
    expect(canModerate('admin', 'admin')).toBe(false);
    expect(canModerate('admin', 'user')).toBe(true);
    expect(canModerate('super_admin', 'admin')).toBe(true);
    expect(roleRank('owner')).toBeGreaterThan(roleRank('super_admin'));
  });

  it('`manage_live` declara que depende do OBJETO', () => {
    // A regra real e "staff OU dono da live". Quem a responde e
    // `canModerateLive(isAdmin, live, user)`; a entrada no mapa cobre so a
    // metade de cargo, e precisa dizer isso.
    expect(CAPACIDADES.manage_live.dependeDoObjeto).toMatch(/canModerateLive/);
  });
});
