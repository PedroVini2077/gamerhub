import { describe, it, expect } from 'vitest';
import {
  ROLES, ROLE_DISPLAY, roleLabel, roleLabelCasual, roleTag, roleDotColor,
} from '../roleLabels';

describe('roleLabels', () => {
  // Este é o teste que importa: se alguém criar um cargo novo e esquecer de
  // preencher qualquer um dos campos, isto falha. Foi exatamente esse
  // esquecimento — mapas escritos antes de `owner` existir — que deixou o
  // Fundador sem nome e sem cor no chat da live.
  it('todo papel de ROLES tem nome e cor nos dois vocabulários', () => {
    for (const role of ROLES) {
      const d = ROLE_DISPLAY[role];
      expect(d, `faltou registrar o papel "${role}"`).toBeDefined();
      for (const field of ['admin', 'casual', 'tag', 'dot']) {
        expect(d[field], `papel "${role}" sem o campo "${field}"`).toBeTruthy();
      }
    }
  });

  it('não sobra registro para papel que não existe em ROLES', () => {
    expect(Object.keys(ROLE_DISPLAY).sort()).toEqual([...ROLES].sort());
  });

  it('o Fundador é nomeado e colorido em todos os contextos', () => {
    expect(roleLabel('owner')).toBe('Fundador');
    expect(roleLabelCasual('owner')).toBe('Fundador');
    expect(roleTag('owner')).toBe('tag-orange');
    expect(roleDotColor('owner')).toBe('#f97316');
  });

  it('cada papel tem uma cor distinta dos demais', () => {
    const tags = ROLES.map(roleTag);
    const dots = ROLES.map(roleDotColor);
    expect(new Set(tags).size).toBe(ROLES.length);
    expect(new Set(dots).size).toBe(ROLES.length);
  });

  it('usa vocabulários diferentes para o usuário comum', () => {
    expect(roleLabel('user')).toBe('Usuário');
    expect(roleLabelCasual('user')).toBe('Player');
  });

  it('papel desconhecido não quebra a UI', () => {
    expect(roleLabel('moderador_novo')).toBe('moderador_novo');
    expect(roleLabelCasual('moderador_novo')).toBe('Player');
    expect(roleTag('moderador_novo')).toBe('tag-cyan');
    expect(roleDotColor('moderador_novo')).toBe('#6b7280');
    expect(roleLabel(undefined)).toBe('Usuário');
    expect(roleTag(undefined)).toBe('tag-cyan');
  });
});
