/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import SugestoesDaMateria from '../SugestoesDaMateria';

/**
 * `[02/10]` "AS SUGESTÕES NÃO ESTÃO APARECENDO MAIS" — e não era bug.
 *
 * ── O que ele relatou, e o que estava acontecendo ─────────────────────────
 *
 * *"as sugestões não estão aparecendo mais, em nenhum news que eu tento
 * postar"*. Era o conserto da véspera funcionando.
 *
 * Os rascunhos dele vêm do radar e **já nascem com a editoria preenchida**. O
 * botão só aparece quando a sugestão DISCORDA do que está escolhido — então,
 * enquanto ela errava (`filmes-series` para uma matéria de Diablo IV), ela
 * discordava e o botão aparecia. Quando passou a acertar, concordou e sumiu.
 *
 * Medido nos cinco títulos reais do site:
 *
 *     Diablo IV temporada 15 …      antes: filmes-series   hoje: gaming
 *     Sony traz upscaling por IA …  antes: ia              hoje: null (empate)
 *     Xbox / Nintendo (3 títulos)   antes: null            hoje: gaming
 *
 * ── O defeito REAL, que é de tela ─────────────────────────────────────────
 *
 * Um bloco chamado "Sugestões" que só mostra avisos **parece quebrado**. E o
 * silêncio é resposta ambígua: não dá para distinguir *"conferi e está certo"*
 * de *"não consegui dizer nada"*. São estados opostos e a tela mostrava o
 * mesmo nada para os dois.
 *
 * A trava guarda as duas pontas — a tela confirma quando concorda, e **não
 * oferece botão** nesse caso, porque aplicar o que já está aplicado é ruído.
 */

afterEach(cleanup);

const BASE = {
  titulo: 'Diablo IV temporada 15 transforma o jogo em museu dos 30 anos da série',
  conteudo: '', resumo: '', fonte_url: '', capa_url: '',
};

describe('a sugestao que CONCORDA nao fica muda', () => {
  it('diz que a editoria sugerida ja e a escolhida — e sem botao', () => {
    render(<SugestoesDaMateria campos={{ ...BASE, editoria: 'gaming' }} onAplicar={() => {}} />);

    expect(screen.getByText(/ja esta escolhida|já está escolhida/i),
      'quando a sugestao concorda, o bloco mostrava so avisos e parecia quebrado')
      .toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Editoria:/ }),
      'aplicar o que ja esta aplicado nao e oferta, e ruido').toBeNull();
  });

  it('quando DISCORDA, continua sendo um botao que a pessoa clica', () => {
    const aplicou = vi.fn();
    render(<SugestoesDaMateria campos={{ ...BASE, editoria: 'geek' }} onAplicar={aplicou} />);

    const botao = screen.getByRole('button', { name: /Editoria: Games/i });
    expect(aplicou, 'nada pode ser aplicado sozinho — quem assina a materia e '
      + 'quem clicou').not.toHaveBeenCalled();

    fireEvent.click(botao);
    expect(aplicou).toHaveBeenCalledWith('editoria', 'gaming');
  });

  it('sem sugestao nenhuma, nao inventa confirmacao', () => {
    // Titulo sem pista: a tela nao pode dizer "ja esta escolhida" sobre uma
    // editoria que o assistente nao sugeriu. Seria confirmar o que ele nao viu.
    render(<SugestoesDaMateria
      campos={{ ...BASE, titulo: 'Comunicado da equipe', editoria: 'gaming' }}
      onAplicar={() => {}} />);
    expect(screen.queryByText(/ja esta escolhida|já está escolhida/i)).toBeNull();
  });

  it('materia completa e sem aviso continua nao mostrando NADA', () => {
    // A confirmacao nao pode virar motivo para o bloco existir: painel que
    // fala quando nao tem o que dizer e o comeco da fadiga de alarme.
    //
    // O TÍTULO AQUI PRECISA GERAR SUGESTÃO, e a primeira versão deste teste
    // não gerava: usava «Diablo IV ganha nova temporada», que devolve `null`
    // (de propósito — `diablo` não está no vocabulário). Com `null`, não havia
    // confirmação para virar motivo de nada, e a reinjeção **não falhou**.
    // Descoberto reinjetando, que é para isso que a reinjeção serve.
    const { container } = render(<SugestoesDaMateria campos={{
      titulo: 'Xbox anuncia novidades do gameplay', editoria: 'gaming',
      conteudo: 'a'.repeat(400), resumo: 'Tem resumo.',
      fonte_url: 'https://exemplo.com', capa_url: 'https://exemplo.com/c.jpg',
    }} onAplicar={() => {}} />);
    expect(container.firstChild, 'painel que fala quando nao tem o que dizer e o '
      + 'comeco da fadiga de alarme — a confirmacao nao pode fazer o bloco '
      + 'aparecer sozinha').toBeNull();
  });
});
