import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor/three/addons/environments', { recursive: true });
await mkdir('dist/vendor/three/addons/utils', { recursive: true });
for (const file of await readdir('src')) await cp(`src/${file}`, `dist/${file}`);
await cp('node_modules/three/build/three.module.js', 'dist/vendor/three/three.module.js');
await cp('node_modules/three/examples/jsm/environments/RoomEnvironment.js', 'dist/vendor/three/addons/environments/RoomEnvironment.js');
await cp('node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', 'dist/vendor/three/addons/utils/BufferGeometryUtils.js');
await cp('node_modules/three/LICENSE', 'dist/vendor/three/LICENSE');
for (const file of ['build-collection.mjs', 'build-collection-v4.mjs']) {
  execFileSync(process.execPath, [`dist/${file}`], { stdio: 'inherit' });
  await rm(`dist/${file}`);
}
