import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
// An explicit override lets offline developers reuse an existing esbuild installation.
const { build } = await import(process.env.DSH_ESBUILD_PATH
  ? pathToFileURL(process.env.DSH_ESBUILD_PATH).href : 'esbuild');
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
await mkdir(new URL('lib/', root), { recursive: true });
await copyFile(new URL('src/index.js', root), new URL('lib/index.js', root));
await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['src/client.js'],
  outfile: 'lib/client.js',
  bundle: true, format: 'cjs', platform: 'browser', target: 'es2022',
  external: ['react'], loader: { '.css': 'text' }, charset: 'utf8',
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(manifest.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
});
