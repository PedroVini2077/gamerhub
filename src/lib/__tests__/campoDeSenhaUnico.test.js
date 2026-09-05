/**
 * TRAVA: todo campo de senha do site passa pelo `CampoDeSenha`.
 *
 * ── Os dois defeitos que ela impede de voltar ───────────────────────────────
 *
 * **O olho só existia no celular.** Relato do dono em 05/09: *"aquele olho pra
 * mostrar senha ou não? só aparece no celular, no PC não existe"*. Aquele olho
 * nunca foi do site — é o botão nativo que alguns navegadores de Android
 * desenham dentro de campo de senha. No Chrome de computador ele não existe, e
 * no Firefox e no Safari não existe em lugar nenhum. Metade das pessoas tinha o
 * recurso e a outra metade não, sem ninguém ter decidido isso.
 *
 * **O campo saiu BRANCO.** No cofre do Fundador eu escrevi `className="input"` —
 * uma classe que não existe neste projeto (a de verdade é `.input-gamer`). Sem
 * estilo, o `<input>` cai no padrão do navegador, que no Android é caixa branca
 * com texto preto, no meio de um site escuro.
 *
 * ── Por que uma trava, e não confiança ──────────────────────────────────────
 *
 * Os dois defeitos são **invisíveis para todo o resto da rede**: build passa,
 * lint passa, teste passa, e a tela funciona — só fica errada. Só apareceram
 * porque o dono abriu o site no celular dele e mandou um print. Isso não é
 * cobertura, é sorte, e sorte não escala para o próximo campo de senha que
 * alguém escrever.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { varrerFontes } from './varrerFontes';

/** O único arquivo onde `type="password"` é legítimo. */
const O_COMPONENTE = 'src/components/ui/CampoDeSenha.jsx';

describe('campo de senha', () => {
  it('nenhuma tela escreve type="password" na mão', () => {
    const infratores = varrerFontes('src')
      .filter((caminho) => caminho.replace(/\\/g, '/') !== O_COMPONENTE)
      .filter((caminho) => /type=["']password["']/.test(readFileSync(caminho, 'utf8')));

    expect(
      infratores,
      'campo de senha escrito na mao, fora do componente.\n'
      + 'Ele nao vai ter o olho de mostrar/ocultar no computador — e o nativo do\n'
      + 'Android so aparece em ALGUNS navegadores, entao o recurso fica sendo\n'
      + 'sorte de aparelho. Use <CampoDeSenha> (src/components/ui).',
    ).toEqual([]);
  });

  it('o componente esconde o olho NATIVO, senão ficam dois no Android', () => {
    const css = readFileSync('src/estilos/componentes.css', 'utf8');

    // Cada seletor é de um navegador diferente. Perder um deixa o olho nativo
    // voltar só naquele — e o defeito reaparece para uma fatia das pessoas.
    for (const seletor of [
      '::-ms-reveal',
      '::-webkit-credentials-auto-fill-button',
      '::-webkit-strong-password-auto-fill-button',
    ]) {
      expect(
        css.includes(`.campo-de-senha${seletor}`),
        `componentes.css perdeu a regra \`.campo-de-senha${seletor}\`.\n`
        + 'Sem ela o navegador desenha o olho DELE dentro do campo, e ficam dois\n'
        + 'olhos lado a lado — o nosso e o dele.',
      ).toBe(true);
    }
  });

  it('o preenchimento automático não pinta o campo de branco', () => {
    const css = readFileSync('src/estilos/componentes.css', 'utf8');

    // O navegador IGNORA `background` no estado de autofill, mas respeita a
    // sombra interna. Sem isto o campo fica branco com texto branco: invisível.
    expect(
      /:-webkit-autofill[\s\S]{0,400}box-shadow[^;]*inset/.test(css),
      'componentes.css perdeu a correcao de `-webkit-autofill`.\n'
      + 'Sem ela, o navegador pinta o campo preenchido de BRANCO — e como o\n'
      + 'texto do site e branco, o que a pessoa digitou some.\n'
      + '`background` nao resolve: o navegador ignora. A sombra interna resolve.',
    ).toBe(true);
  });

  it('o botão do olho é acessível e não envia o formulário', () => {
    const fonte = readFileSync(O_COMPONENTE, 'utf8');

    expect(fonte.includes('aria-pressed'),
      `${O_COMPONENTE}: o botao do olho perdeu o \`aria-pressed\`.\n`
      + 'Ele e um alternador, e sem isso o leitor de tela nao anuncia o estado.',
    ).toBe(true);

    expect(fonte.includes('aria-label'),
      `${O_COMPONENTE}: botao so-icone SEM nome acessivel (§4).`).toBe(true);

    // Dentro de um `<form>`, o padrao de um `<button>` e SUBMIT: sem isto,
    // clicar no olho ENVIA o formulario em vez de mostrar a senha.
    expect(fonte.includes('type="button"'),
      `${O_COMPONENTE}: o botao do olho perdeu \`type="button"\`.\n`
      + 'Dentro de um <form> ele passa a ENVIAR o formulario ao ser clicado.',
    ).toBe(true);
  });
});
