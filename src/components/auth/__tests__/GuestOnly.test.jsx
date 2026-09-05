/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Trava do portão de visitante — as QUATRO combinações, e não só a que quebrou.
 *
 * ── O bug de 03/09 ──────────────────────────────────────────────────────────
 *
 * O `GuestOnly` só olhava `user`. Com o projeto Supabase **pausado**, a sessão
 * continua no `localStorage` e `getSession()` a restaura sem tocar na rede —
 * então `user` fica preenchido, o portão mandava `/login` de volta para `/`, e
 * lá a landing oferecia "Entrar" outra vez. Laço sem saída: o dono relatou como
 * *"ainda não consigo entrar na área de login e cadastro"*.
 *
 * ── Por que as quatro, e não só a que falhou ────────────────────────────────
 *
 * `pages/Login.jsx` está na lista de arquivos de alto risco do §7, que exige
 * *"teste explícito dos dois lados"*. O lado que a correção poderia estragar é
 * o oposto: com o banco DE PÉ, quem já entrou não pode voltar a ver a tela de
 * login. Esse caso não dá para exercitar no e2e enquanto o projeto está pausado
 * — aqui dá, e é o motivo desta trava existir além da de navegador.
 *
 * A regra que as quatro linhas descrevem em conjunto:
 * **sem banco, o site trata todo mundo como visitante.**
 */

const mockUseAuth = vi.fn();
const mockUseDbOffline = vi.fn();

vi.mock('../../../hooks/useAuth.jsx', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../../../hooks/useDbOffline', () => ({ useDbOffline: () => mockUseDbOffline() }));

const { default: GuestOnly } = await import('../GuestOnly');

function montar({ logado, semBanco }) {
  mockUseAuth.mockReturnValue({ user: logado ? { id: 'u1' } : null });
  mockUseDbOffline.mockReturnValue(semBanco);
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<GuestOnly><p>tela de login</p></GuestOnly>} />
        <Route path="/" element={<p>landing</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const naTela = () => (screen.queryByText('tela de login') ? 'login' : 'landing');

describe('GuestOnly', () => {
  beforeEach(() => { mockUseAuth.mockReset(); mockUseDbOffline.mockReset(); });
  afterEach(cleanup);

  it('visitante com banco de pé: vê a tela de login', () => {
    montar({ logado: false, semBanco: false });
    expect(naTela()).toBe('login');
  });

  it('visitante sem banco: continua vendo a tela de login', () => {
    montar({ logado: false, semBanco: true });
    expect(naTela()).toBe('login');
  });

  it('logado com banco de pé: é mandado embora — o portão continua guardando', () => {
    montar({ logado: true, semBanco: false });
    expect(naTela()).toBe('landing');
  });

  it('logado SEM banco: alcança a tela de login (o bug de 03/09)', () => {
    montar({ logado: true, semBanco: true });
    // Se isto voltar a falhar, o `GuestOnly` deixou de olhar `semBanco` e o
    // site voltou a prender quem tem sessão salva entre `/` e `/login`, sem
    // nenhuma saída pela tela. Ver `components/auth/GuestOnly.jsx`.
    expect(naTela()).toBe('login');
  });
});
