import { copyFile, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const dist = join(root, 'dist')

await rm(dist, { force: true, recursive: true })
await mkdir(join(dist, 'popup'), { recursive: true })

await Promise.all([
  esbuild.build({
    bundle: true,
    entryPoints: [join(root, 'src/content/index.ts')],
    format: 'iife',
    outfile: join(dist, 'content.js'),
    platform: 'browser',
    target: 'chrome120',
  }),
  esbuild.build({
    bundle: true,
    entryPoints: [join(root, 'src/popup/main.ts')],
    format: 'esm',
    outfile: join(dist, 'popup/main.js'),
    platform: 'browser',
    target: 'chrome120',
  }),
])

await Promise.all([
  copyFile(join(root, 'manifest.json'), join(dist, 'manifest.json')),
  copyFile(join(root, 'src/popup/popup.html'), join(dist, 'popup/popup.html')),
  copyFile(join(root, 'src/popup/styles.css'), join(dist, 'popup/styles.css')),
])
