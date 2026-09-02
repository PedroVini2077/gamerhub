import { ShieldOff, UserCog, Bug, Flag, ShieldCheck, MessageSquare } from 'lucide-react';

/**
 * Os assuntos do formulário de contato — fonte ÚNICA no lado do cliente.
 *
 * ── Por que um mapa explícito, e não um `else` ──────────────────────────────
 *
 * Esta lista existe em DOIS lugares: aqui e no `CHECK` da tabela
 * `contact_messages` no banco. Dois lugares que precisam concordar para sempre
 * é a definição de deriva (§6 FASE 4) — e a forma como ela se manifesta já
 * aconteceu neste projeto: o tipo `chat` chegou na fila de moderação, não
 * existia em nenhum mapa, caiu num `else`, e o card ficou girando para sempre.
 *
 * Duas defesas:
 *   1. `rotuloDoAssunto` devolve `undefined` para valor desconhecido — não um
 *      palpite. Quem chama decide o que fazer com o desconhecido, na cara.
 *   2. `src/components/contato/__tests__/assuntosDeContato.test.js` confere
 *      esta lista contra a do banco e QUEBRA se alguém mexer em só um lado.
 *
 * A lista do banco vive em `db/2026-09-02-canal-de-contato.md`; o teste lê a
 * constante abaixo, que é a cópia declarada do CHECK.
 */

/** Exatamente o `CHECK (subject IN (...))` da tabela, na mesma ordem. */
export const ASSUNTOS_DO_BANCO = [
  'banimento', 'conta', 'bug', 'denuncia', 'privacidade', 'outro',
];

export const ASSUNTOS = {
  banimento: {
    rotulo: 'Fui banido ou suspenso',
    icone: ShieldOff,
    cor: 'text-red-400',
    dica: 'Se você ainda consegue entrar, o pedido de revisão dentro do site '
        + 'chega mais rápido — esta via é para quem não consegue.',
  },
  conta: {
    rotulo: 'Problema com a minha conta',
    icone: UserCog,
    cor: 'text-neon-cyan',
    dica: 'Não recebeu o e-mail de confirmação, perdeu o acesso, quer apagar a conta.',
  },
  bug: {
    rotulo: 'Encontrei um erro no site',
    icone: Bug,
    cor: 'text-yellow-400',
    dica: 'Conte o que você estava fazendo quando aconteceu. Isso é metade do conserto.',
  },
  denuncia: {
    rotulo: 'Quero denunciar algo',
    icone: Flag,
    cor: 'text-orange-400',
    dica: 'Conteúdo, comportamento ou perfil. Diga onde você viu.',
  },
  privacidade: {
    rotulo: 'Meus dados pessoais',
    icone: ShieldCheck,
    cor: 'text-neon-green',
    dica: 'Acessar, corrigir ou apagar seus dados. É um direito seu pela LGPD.',
  },
  outro: {
    rotulo: 'Outro assunto',
    icone: MessageSquare,
    cor: 'text-gray-400',
    dica: null,
  },
};

/** `undefined` para assunto desconhecido — de propósito. Ver o cabeçalho. */
export function assuntoDeContato(valor) {
  return ASSUNTOS[valor];
}

/** Só o rótulo, para listas. `undefined` se o valor não é conhecido. */
export function rotuloDoAssunto(valor) {
  return ASSUNTOS[valor]?.rotulo;
}

// Os mesmos números que a RPC `enviar_mensagem_de_contato` valida no banco.
// Aqui eles servem só para a tela AVISAR antes de a pessoa mandar — a
// validação que vale é a do banco, porque o site usa a anon key e qualquer um
// chama a REST API direto (§1.3).
export const LIMITES = {
  nomeMin: 2, nomeMax: 60,
  emailMax: 120,
  mensagemMin: 20, mensagemMax: 2000,
};
