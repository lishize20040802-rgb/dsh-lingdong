import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
// An explicit override lets offline developers reuse an existing esbuild installation.
const { build } = await import(process.env.DSH_ESBUILD_PATH
  ? pathToFileURL(process.env.DSH_ESBUILD_PATH).href : 'esbuild');
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
await mkdir(new URL('lib/', root), { recursive: true });
const check = process.argv.includes('--check');
const host = (await readFile(new URL('src/index.js', root), 'utf8')).replaceAll('\r\n', '\n');
const result = await build({
  write: false,
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['src/client.js'],
  outfile: 'lib/client.js',
  bundle: true, format: 'cjs', platform: 'browser', target: 'es2022',
  external: ['react'], loader: { '.css': 'text' }, charset: 'utf8',
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(manifest.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
});
for (const [file, bytes] of [['lib/index.js', Buffer.from(host)], ['lib/client.js', result.outputFiles[0].contents]]) {
  const target = new URL(file, root);
  if (check) {
    if (!Buffer.from(await readFile(target)).equals(Buffer.from(bytes))) throw new Error(`${file} differs from source build`);
  } else await writeFile(target, bytes);
}
if (check) console.log('PASS shipped bytes match source build');
