import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * A trava da mensagem personalizada de pausa.
 *
 * ── O bug, e por que ele passou tanto tempo ────────────────────────────────
 *
 * Relato do dono em 03/09: *"a msg personalizada não funcionava"*. A causa:
 * `MaintenancePage`, no `App.jsx`, tinha o texto **cravado**:
 *
 *     O GamerHub está temporariamente em manutenção. Voltamos em breve!
 *
 * O `pause_reason` era escrito no painel do owner, salvo no `site_config`, lido
 * pelo `Layout` e guardado no navegador — e **morria ali**. A tela nunca o
 * consultava.
 *
 * Nada quebrava: a pausa funcionava, a tela aparecia, o texto era razoável. Só
 * era o texto errado. É a classe de falha mais difícil de notar — a que produz
 * um resultado plausível.
 *
 * ── Por que varredura de fonte, e não render ───────────────────────────────
 *
 * O que precisa ficar travado é **de onde o texto vem**. Um teste montando a
 * tela com `motivoDaPausa` mockado passaria com o texto cravado de volta, desde
 * que alguém mantivesse o mock — a pergunta certa é sobre a origem, e ela se lê
 * na fonte.
 *
 * O alvo é `components/ui/MaintenancePage.jsx`. Se a tela sair de lá, o
 * primeiro teste falha dizendo isso — e **foi o que aconteceu no mesmo dia**:
 * o `App.jsx` passou de 300 linhas com o docstring novo, a tela foi extraída
 * pelo §4, e esta trava acusou o movimento em vez de passar em silêncio.
 */
describe('a tela de pausa mostra o motivo que o dono escreveu', () => {
  const fonte = readFileSync('src/components/ui/MaintenancePage.jsx', 'utf8');

  it('a tela de pausa ainda mora no arquivo que este teste varre', () => {
    // Sem isto, mover `MaintenancePage` deixaria as travas abaixo verdes para
    // sempre — elas passariam a varrer um arquivo que não tem mais a tela.
    expect(fonte.length, 'MaintenancePage.jsx veio vazio').toBeGreaterThan(400);
    expect(fonte,
      '`MaintenancePage` nao esta mais em components/ui/MaintenancePage.jsx.\n'
      + '  Se foi movida, aponte este teste para o arquivo novo — senao ele\n'
      + '  para de vigiar.')
      .toContain('function MaintenancePage()');
  });

  it('ela lê o motivo por `motivoDaPausa()`', () => {
    const corpo = fonte.slice(fonte.indexOf('function MaintenancePage()'));
    expect(corpo,
      'a tela de pausa nao chama `motivoDaPausa()`.\n'
      + '  Sem isso, o motivo que o dono escreve no painel do owner e salvo no\n'
      + '  banco, cacheado no navegador — e nunca aparece. Foi o bug de 03/09.')
      .toContain('motivoDaPausa()');
  });

  it('e NÃO tem texto de manutenção cravado', () => {
    const corpo = fonte.slice(fonte.indexOf('function MaintenancePage()'));
    // Só o CÓDIGO: o docstring da função conta a história do bug e cita a
    // frase antiga de propósito. Sem tirar comentário, a trava acusaria a
    // própria explicação — foi o que aconteceu com o aviso de bloco pendente
    // no `inicio-de-sessao.sh`, no mesmo dia.
    const codigo = corpo
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');

    // O TÍTULO "Em Manutenção" é legítimo e continua cravado — ele não é o
    // motivo, é o rótulo da tela. O que não pode voltar é a MENSAGEM.
    // (A primeira versão desta trava acusava o título e falhava com o código
    // correto — teste que reprova o certo é tão ruim quanto o que aprova o
    // errado.)
    expect(codigo,
      'voltou MENSAGEM de manutencao cravada na tela de pausa.\n'
      + '  O motivo tem que vir de `motivoDaPausa()`, que resolve os DOIS\n'
      + '  cenarios: pausa deliberada (le do banco) e queda inesperada (le a\n'
      + '  copia do navegador). Texto fixo ignora o painel do owner.\n'
      + '  O titulo "Em Manutencao" pode ficar — ele e o rotulo, nao o motivo.')
      .not.toMatch(/Voltamos em breve|temporariamente em manuten|está fora do ar/i);
  });
});
