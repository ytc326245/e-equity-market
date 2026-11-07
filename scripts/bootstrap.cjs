const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
(async () => {
  const root = path.resolve(__dirname, '..', '.tools');
  await fs.mkdir(root, { recursive: true });
  const meta = await (await fetch('https://registry.npmjs.org/npm/latest')).json();
  const bytes = Buffer.from(await (await fetch(meta.dist.tarball)).arrayBuffer());
  const digest = 'sha512-' + crypto.createHash('sha512').update(bytes).digest('base64');
  if (digest !== meta.dist.integrity) throw new Error('npm 下载完整性校验失败');
  const archive = path.join(root, 'npm.tgz');
  await fs.writeFile(archive, bytes);
  execFileSync('tar', ['-xf', archive, '-C', root]);
  console.log(`npm ${meta.version} ready: ${path.join(root, 'package', 'bin', 'npm-cli.js')}`);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
