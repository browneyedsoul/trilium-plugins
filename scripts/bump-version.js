import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [type, plugin] = process.argv.slice(2)

if (!type || !plugin) {
  console.error('Usage: pnpm bump:<major|minor|patch> <plugin-name>')
  console.error('Example: pnpm bump:minor outliner')
  process.exit(1)
}

const pluginDir = join('plugins', plugin)
const pkgPath = join(pluginDir, 'package.json')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)

const nextVersion = {
  major: `${major + 1}.0.0`,
  minor: `${major}.${minor + 1}.0`,
  patch: `${major}.${minor}.${patch + 1}`,
}[type]

if (!nextVersion) {
  console.error(`Invalid bump type: ${type} (expected major, minor, or patch)`)
  process.exit(1)
}

const oldVersion = pkg.version
pkg.version = nextVersion
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(`${pkgPath}: ${oldVersion} → ${nextVersion}`)

// Find and update JS/JSX file
const jsFile = readdirSync(pluginDir).find((f) => f.endsWith('.js') || f.endsWith('.jsx'))

if (jsFile) {
  const jsPath = join(pluginDir, jsFile)
  const content = readFileSync(jsPath, 'utf-8')
  const updated = content.replace(
    /static get VERSION\(\)\s*\{[\s\S]*?return\s*'.*?'[\s\S]*?\}/,
    `static get VERSION() {\n    return '${nextVersion}'\n  }`
  )

  if (content !== updated) {
    writeFileSync(jsPath, updated)
    console.log(`${jsPath}: ${oldVersion} → ${nextVersion}`)
  } else {
    console.log(`${jsPath}: no VERSION() getter found, skipped`)
  }
}

console.log(`Done. ${plugin} bumped to ${nextVersion}`)
