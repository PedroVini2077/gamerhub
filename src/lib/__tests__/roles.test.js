import { describe, it, expect } from 'vitest';
import { canModerateLive } from '../roles';

// Esta regra existe em dois lugares no cliente (a página da live e o hook do
// chat) e precisa concordar com as policies de `live_chat_timeouts` no banco:
//   is_staff() OR auth.uid() = posts.user_id
// Se alguém mudar um dos lados sem o outro, o painel volta a prometer uma ação
// que a RLS recusa em silêncio.
describe('canModerateLive', () => {
  const eu = { id: 'u1' };
  const minhaLive = { id: 'l1', user_id: 'u1' };
  const liveAlheia = { id: 'l2', user_id: 'u2' };

  it('staff modera qualquer live', () => {
    expect(canModerateLive(true, liveAlheia, eu)).toBe(true);
  });

  it('dono da live modera a própria, mesmo sendo usuário comum', () => {
    expect(canModerateLive(false, minhaLive, eu)).toBe(true);
  });

  it('usuário comum NÃO modera live alheia', () => {
    expect(canModerateLive(false, liveAlheia, eu)).toBe(false);
  });

  it('sem live selecionada ou sem usuário, ninguém modera', () => {
    expect(canModerateLive(false, null, eu)).toBe(false);
    expect(canModerateLive(false, minhaLive, null)).toBe(false);
  });

  it('devolve booleano, nunca null/undefined — o valor vira prop de UI', () => {
    expect(canModerateLive(false, null, null)).toBe(false);
  });
});
