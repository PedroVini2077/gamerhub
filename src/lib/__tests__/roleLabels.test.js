import { describe, it, expect } from 'vitest';
import { ROLES, ROLE_LABELS, roleLabel, roleLabelCasual } from '../roleLabels';

describe('roleLabels', () => {
  // Este é o teste que importa: se alguém criar um cargo novo e esquecer de
  // registrar um dos vocabulários, isto falha. Foi exatamente esse esquecimento
  // que deixou o Fundador sem badge no chat da live.
  it('todo papel de ROLES tem os dois rótulos', () => {
    for (const role of ROLES) {
      expect(ROLE_LABELS[role], `faltou registrar o papel "${role}"`).toBeDefined();
      expect(ROLE_LABELS[role].admin).toBeTruthy();
      expect(ROLE_LABELS[role].casual).toBeTruthy();
    }
  });

  it('não sobra rótulo para papel que não existe em ROLES', () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual([...ROLES].sort());
  });

  it('o Fundador é nomeado nos dois vocabulários', () => {
    expect(roleLabel('owner')).toBe('Fundador');
    expect(roleLabelCasual('owner')).toBe('Fundador');
  });

  it('usa vocabulários diferentes para o usuário comum', () => {
    expect(roleLabel('user')).toBe('Usuário');
    expect(roleLabelCasual('user')).toBe('Player');
  });

  it('papel desconhecido não quebra a UI', () => {
    expect(roleLabel('moderador_novo')).toBe('moderador_novo');
    expect(roleLabelCasual('moderador_novo')).toBe('Player');
    expect(roleLabel(undefined)).toBe('Usuário');
    expect(roleLabelCasual(undefined)).toBe('Player');
  });
});
