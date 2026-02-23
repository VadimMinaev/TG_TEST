const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIRS = ['src', 'server'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md']);
const IGNORE_DIRS = new Set(['node_modules', 'build', '.git', 'dist']);

const BAD_PATTERNS = [
  { name: 'cp1251 mojibake (Р + latin-1 supplement)', regex: /\u0420[\u00B0-\u00BF]/g },
  {
    name: 'cp1251 mojibake (С + punctuation block)',
    regex: /\u0421[\u0402\u0403\u201A\u201E\u2026\u2020\u2021\u20AC\u2030\u0409\u2039\u040A\u040C\u040B\u040F\u0452\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u2122\u0459\u203A\u045A\u045C\u045B\u045F]/g
  },
  { name: 'latin-1 mojibake (Ð + latin)', regex: /\u00D0[A-Za-z]/g },
  { name: 'latin-1 mojibake (Ñ + latin)', regex: /\u00D1[A-Za-z]/g },
  { name: 'emoji/text mojibake fragments', regex: /\u0440\u045F|\u0432\u201A|\u0432\u045A|\u0432\u040F/g }
];

// Extra-strict patterns for newly added lines in git diff.
// This catches newly introduced mojibake without requiring a full legacy cleanup.
const DIFF_BAD_PATTERNS = [
  { name: 'mixed cp1251 mojibake (Р/С + latin)', regex: /[\u0420\u0421][A-Za-z]/g },
  { name: 'broken utf-8 mojibake marker', regex: /вЂ|вљ|вќ|tg“|tg”|v\?/g },
  { name: 'latin-1 mojibake (Ð + latin)', regex: /\u00D0[A-Za-z]/g },
  { name: 'latin-1 mojibake (Ñ + latin)', regex: /\u00D1[A-Za-z]/g }
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

function findLine(text, index) {
  const lines = text.slice(0, index).split('\n');
  return lines.length;
}

function getAddedLinesFromGitDiff(relPath) {
  try {
    const raw = execSync(`git diff --unified=0 -- "${relPath.replace(/"/g, '\\"')}"`, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    });

    const added = [];
    let currentNewLine = 0;
    for (const line of raw.split('\n')) {
      const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      if (hunk) {
        currentNewLine = Number(hunk[1]);
        continue;
      }
      if (line.startsWith('+++') || line.startsWith('---')) continue;
      if (line.startsWith('+')) {
        added.push({ line: currentNewLine, text: line.slice(1) });
        currentNewLine += 1;
        continue;
      }
      if (line.startsWith('-')) continue;
      if (line.startsWith(' ')) {
        currentNewLine += 1;
      }
    }
    return added;
  } catch {
    return [];
  }
}

const files = [];
ROOT_DIRS.forEach((d) => walk(path.resolve(process.cwd(), d), files));

const problems = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const { name, regex } of BAD_PATTERNS) {
    regex.lastIndex = 0;
    const match = regex.exec(text);
    if (!match) continue;
    const line = findLine(text, match.index);
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    const lineText = text.split('\n')[line - 1]?.trim() || '';
    problems.push({ rel, line, name, lineText });
  }
}

// Guard against newly added mojibake in changed files only.
for (const file of files) {
  const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
  const addedLines = getAddedLinesFromGitDiff(rel);
  if (!addedLines.length) continue;
  for (const added of addedLines) {
    for (const { name, regex } of DIFF_BAD_PATTERNS) {
      regex.lastIndex = 0;
      if (!regex.test(added.text)) continue;
      problems.push({
        rel,
        line: added.line,
        name: `${name} [added-line-check]`,
        lineText: added.text.trim()
      });
    }
  }
}

if (problems.length > 0) {
  console.error('Encoding check failed. Possible mojibake found:');
  for (const p of problems) {
    console.error(`- ${p.rel}:${p.line} [${p.name}]`);
    console.error(`  ${p.lineText}`);
  }
  process.exit(1);
}

console.log('Encoding check passed.');
