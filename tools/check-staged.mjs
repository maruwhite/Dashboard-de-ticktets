// Pre-commit: rechaza archivos que nunca deben llegar al repositorio (datos reales y
// credenciales), aunque se hayan agregado a la fuerza con `git add -f`.
import { execFileSync } from 'node:child_process';

const FORBIDDEN = [
  { test: (path) => path === 'data' || path.startsWith('data/'), reason: 'carpeta data/' },
  {
    test: (path) => /(^|\/)\.env(\..+)?$/.test(path) && !path.endsWith('.env.example'),
    reason: 'archivo .env',
  },
  { test: (path) => /\.(xlsx|xls)$/i.test(path), reason: 'planilla Excel' },
  {
    test: (path) => /\.csv$/i.test(path) && !/(^|\/)(sample|ejemplo)[^/]*\.csv$/i.test(path),
    reason: 'archivo CSV',
  },
];

const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
})
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const blocked = staged.flatMap((path) => {
  const rule = FORBIDDEN.find(({ test }) => test(path));
  return rule ? [`  - ${path} (${rule.reason})`] : [];
});

if (blocked.length > 0) {
  process.stderr.write(
    `Commit rechazado: estos archivos no pueden subirse al repositorio:\n${blocked.join('\n')}\n` +
      'Sacalos del commit con: git restore --staged <archivo>\n',
  );
  process.exit(1);
}
