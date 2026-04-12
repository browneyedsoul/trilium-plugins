const REPO = 'browneyedsoul/trilium-plugins'
const CHECK_INTERVAL = 60 * 60 * 1000
const CACHE_KEY = `trilium-plugins-update-check-${REPO}`
const PLUGIN_PREFIX = 'trilium-plugin-'
const TOAST_ID = `trilium-plugins-update-check-${REPO}`

function getInstalledPlugins() {
  const plugins = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key.startsWith(PLUGIN_PREFIX) && key !== CACHE_KEY) {
      plugins.push({
        name: key.slice(PLUGIN_PREFIX.length),
        version: localStorage.getItem(key),
      })
    }
  }
  return plugins
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}

function showToast(updates) {
  if (document.getElementById(TOAST_ID)) return

  const items = updates
    .map(u => {
      const url = `https://github.com/${REPO}/releases/tag/${u.tag}`
      return `<li style="margin:4px 0;">
        <strong>${u.name}</strong> v${u.current} → v${u.latest}
        <a href="${url}" target="_blank" style="color:#58a6ff;margin-left:6px;">Release</a>
      </li>`
    })
    .join('')

  const toast = document.createElement('div')
  toast.id = TOAST_ID
  toast.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <strong style="color:#e6e6e6;">Plugin updates available</strong>
      <button style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;">✕</button>
    </div>
    <ul style="list-style:none;padding:0;margin:0;">${items}</ul>
  `
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: '99999',
    background: '#1e1e1e',
    color: '#ccc',
    border: '1px solid #444',
    borderRadius: '8px',
    padding: '14px 18px',
    fontSize: '13px',
    maxWidth: '360px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  })

  toast.querySelector('button').onclick = () => toast.remove()
  document.body.appendChild(toast)
}

async function checkForUpdates() {
  const lastCheck = localStorage.getItem(CACHE_KEY)
  if (lastCheck && Date.now() - Number(lastCheck) < CHECK_INTERVAL) return

  localStorage.setItem(CACHE_KEY, String(Date.now()))

  const plugins = getInstalledPlugins()
  if (plugins.length === 0) return

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/tags`)
    if (!res.ok) return

    const tags = (await res.json()).map(t => t.name)
    const updates = []

    for (const plugin of plugins) {
      const prefix = `${plugin.name}@`
      const versions = tags
        .filter(t => t.startsWith(prefix))
        .map(t => t.slice(prefix.length))
        .sort(compareVersions)

      if (versions.length === 0) continue

      const latest = versions[versions.length - 1]
      if (compareVersions(latest, plugin.version) > 0) {
        updates.push({ name: plugin.name, current: plugin.version, latest, tag: `${prefix}${latest}` })
      }
    }

    if (updates.length > 0) showToast(updates)
  } catch (_) {
    // 네트워크 오류 시 무시
  }
}

checkForUpdates()
