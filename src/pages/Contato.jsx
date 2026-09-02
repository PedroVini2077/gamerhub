import { Mail } from 'lucide-react';
import PaginaDeConteudo from '../components/conteudo/PaginaDeConteudo';
import FormularioDeContato from '../components/contato/FormularioDeContato';

/**
 * O canal de contato público.
 *
 * Pedido do dono em 02/09: *"nós precisamos de uma maneira dos usuários
 * falarem com a administração de fora do site"*. "De fora" é o requisito
 * inteiro — quem está banido, quem nunca criou conta e quem perdeu o acesso
 * são exatamente as pessoas que mais precisam falar com a equipe, e todas elas
 * estão do lado de fora do `RequireAuth`.
 *
 * Por isso esta rota é pública, e por isso ela não pede login nem confere
 * nada sobre o e-mail informado (ver `FormularioDeContato`).
 */
const BLOCOS = [
  {
    id: 'antes-de-escrever',
    icone: 'Rocket',
    titulo: 'Antes de escrever, dois atalhos',
    paragrafos: [
      'Se você ainda consegue entrar na sua conta, o caminho de dentro do site '
      + 'é mais rápido e chega direto na equipe certa: o pedido de revisão de '
      + 'banimento aparece na própria tela de bloqueio, e a denúncia de '
      + 'conteúdo tem botão em cada post.',
      'Este formulário existe para quando esse caminho não está disponível — '
      + 'ou quando o assunto não é nenhum dos dois.',
    ],
  },
  {
    id: 'o-que-esperar',
    icone: 'Timer',
    titulo: 'O que esperar',
    paragrafos: [
      'O GamerHub é tocado por um time pequeno, sem atendimento em tempo real. '
      + 'A resposta chega por e-mail e pode levar alguns dias.',
      'Cada endereço pode enviar até três mensagens por dia. Não é para '
      + 'dificultar: é o que impede um robô de encher a caixa e enterrar as '
      + 'mensagens de quem precisa de verdade.',
    ],
  },
];

export default function Contato() {
  return (
    <PaginaDeConteudo
      eyebrow="Contato"
      icone={Mail}
      titulo="Falar com"
      destaque="a administração."
      rodapeDoTitulo="Funciona sem conta e sem login — inclusive para quem está banido."
      blocos={BLOCOS}
    >
      <FormularioDeContato />
    </PaginaDeConteudo>
  );
}
