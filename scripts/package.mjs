import { Buffer } from 'node:buffer'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const dist = join(root, 'dist')
const release = join(root, 'release')
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const output = join(release, `${packageJson.name}-v${packageJson.version}.zip`)

await mkdir(release, { recursive: true })

const entries = {}
for (const file of await collectFiles(dist)) {
  const name = relative(dist, file).split(sep).join('/')
  entries[name] = new Uint8Array(await readFile(file))
}

await writeFile(output, Buffer.from(zipSync(entries, { level: 9 })))

console.log(`Created ${relative(root, output)}`)

async function collectFiles(directory) {
  const children = await readdir(directory)
  const files = []

  for (const child of children) {
    const fullPath = join(directory, child)
    const info = await stat(fullPath)

    if (info.isDirectory()) {
      files.push(...await collectFiles(fullPath))
    }
    else if (info.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}
