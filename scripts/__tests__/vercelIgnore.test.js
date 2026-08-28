import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Importado explicitamente: o ESLint deste projeto assume ambiente de navegador,
// onde `process` global nao existe. Import nomeado resolve sem afrouxar a regra.
import process from 'node:process';

// Trava do `scripts/vercel-ignore.sh` — o script que decide se a Vercel
// constrói um commit.
//
// ── Por que ele merece teste, e não revisão de olho ─────────────────────────
//
// Ele é o único código do projeto onde **errar para o lado do "pula" não
// quebra nada visivelmente**: o deploy simplesmente não acontece, a Vercel
// continua servindo a versão anterior, e o site fica desatualizado em silêncio.
// Ninguém recebe erro, nenhum teste quebra, nada aparece em log. Falha
// silenciosa pura (CLAUDE.md §1.5), na peça que decide se o site atualiza.
//
// Por isso a regra estava anotada no backlog em vez de corrigida na hora: o
// item dizia, com todas as letras, que mexer nela pedia teste antes, não um
// chute. Este arquivo é esse teste.
//
// ── Como ele testa ──────────────────────────────────────────────────────────
//
// Monta um repositório git de verdade num diretório temporário, faz dois
// commits e roda o script. Nada de simular `git`: o comportamento que importa
// é justamente o do `git diff --quiet` com pathspec de exclusão, e simular isso
// testaria a simulação, não o script.

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(RAIZ, 'scripts/vercel-ignore.sh');

const PULA = 0;      // exit 0 -> a Vercel NAO constroi
const CONSTROI = 1;  // exit 1 -> a Vercel constroi

let repo;

function git(...args) {
  execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
}

function escrever(caminho, conteudo) {
  const destino = join(repo, caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, conteudo);
}

/**
 * Roda o script como a Vercel roda e devolve o código de saída.
 * @param {string} branch valor de VERCEL_GIT_COMMIT_REF
 */
function decidir(branch = 'main') {
  try {
    execSync(`bash "${SCRIPT}"`, {
      cwd: repo,
      env: { ...process.env, VERCEL_GIT_COMMIT_REF: branch },
      stdio: 'pipe',
    });
    return PULA;
  } catch (e) {
    return e.status;
  }
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'vercel-ignore-'));
  git('init', '-q');
  git('config', 'user.email', 'teste@exemplo.com');
  git('config', 'user.name', 'teste');

  // O script vive dentro do repo que ele analisa, então precisa existir aqui.
  mkdirSync(join(repo, 'scripts'), { recursive: true });
  cpSync(SCRIPT, join(repo, 'scripts/vercel-ignore.sh'));

  escrever('src/App.jsx', 'inicial');
  escrever('src/lib/__tests__/algo.test.js', 'inicial');
  escrever('docs/ALGO.md', 'inicial');
  escrever('vercel.json', '{}');
  git('add', '-A');
  git('commit', '-qm', 'primeiro');
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

function commitar(caminho, conteudo) {
  escrever(caminho, conteudo);
  git('add', '-A');
  git('commit', '-qm', `muda ${caminho}`);
}

describe('quando o script manda CONSTRUIR', () => {
  it('mudança em código que vai para o navegador', () => {
    commitar('src/App.jsx', 'mudou');
    expect(decidir()).toBe(CONSTROI);
  });

  it('mudança no próprio vercel.json (headers e rewrites só valem após deploy)', () => {
    commitar('vercel.json', '{"a":1}');
    expect(decidir()).toBe(CONSTROI);
  });

  it('teste E código no mesmo commit — o código manda', () => {
    escrever('src/lib/__tests__/algo.test.js', 'mudou');
    escrever('src/App.jsx', 'mudou tambem');
    git('add', '-A');
    git('commit', '-qm', 'os dois');
    expect(
      decidir(),
      'o commit toca codigo real; a presenca de um teste junto nao pode anular isso',
    ).toBe(CONSTROI);
  });

  it('na dúvida constrói: sem commit anterior para comparar', () => {
    // Repositório de um commit só: `HEAD^` não existe. Pular aqui deixaria o
    // site velho no ar sem ninguém saber, então o script erra para o build.
    expect(decidir()).toBe(CONSTROI);
  });
});

describe('quando o script manda PULAR', () => {
  it('mudança só em documentação', () => {
    commitar('docs/ALGO.md', 'mudou');
    expect(decidir()).toBe(PULA);
  });

  it('mudança só em teste dentro de src/ — a correção de 28/08', () => {
    commitar('src/lib/__tests__/algo.test.js', 'mudou');
    expect(
      decidir(),
      'teste mora em src/ mas nao entra no bundle. Antes desta exclusao, o merge '
      + 'do PR #68 gastou um deploy de producao mexendo so num arquivo de teste.',
    ).toBe(PULA);
  });

  it('branch que não é a main nunca constrói', () => {
    commitar('src/App.jsx', 'mudou');
    expect(
      decidir('claude/qualquer-coisa'),
      'preview de branch foi o que estourou o teto de 100 deploys/dia em 23/08',
    ).toBe(PULA);
  });
});
