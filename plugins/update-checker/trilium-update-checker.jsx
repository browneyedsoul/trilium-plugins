import { defineWidget, useState, useEffect } from "trilium:preact";

const REPO = 'browneyedsoul/trilium-plugins'
const CHECK_INTERVAL = 24 * 60 * 60 * 1000
const CACHE_KEY = 'trilium-plugins-update-check'

const PLUGINS = [
  { name: 'outliner', version: '1.0.0' },
]

const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1
    if ((pa[i] || 0) < (pb[i] || 0)) return -1
  }
  return 0
}

const checkForUpdates = async () => {
  const lastCheck = localStorage.getItem(CACHE_KEY)
  if (lastCheck && Date.now() - Number(lastCheck) < CHECK_INTERVAL) return []

  localStorage.setItem(CACHE_KEY, String(Date.now()))

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/tags`)
    if (!res.ok) return []

    const tags = (await res.json()).map(t => t.name)
    const updates = []

    for (const plugin of PLUGINS) {
      const prefix = `${plugin.name}@`
      const versions = tags
        .filter(t => t.startsWith(prefix))
        .map(t => t.slice(prefix.length))
        .sort(compareVersions)

      if (versions.length === 0) continue

      const latest = versions[versions.length - 1]
      if (compareVersions(latest, plugin.version) > 0) {
        updates.push({
          name: plugin.name,
          current: plugin.version,
          latest,
          tag: `${prefix}${latest}`,
        })
      }
    }

    return updates
  } catch (_) {
    return []
  }
}

const toastStyle = {
  position: 'fixed',
  bottom: '20px',
  right: '20px',
  zIndex: 99999,
  background: '#1e1e1e',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: '8px',
  padding: '14px 18px',
  fontSize: '13px',
  maxWidth: '360px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
}

const UpdateToast = () => {
  const [updates, setUpdates] = useState([])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    checkForUpdates().then(setUpdates)
  }, [])

  if (updates.length === 0 || !visible) return null

  return (
    <div style={toastStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ color: '#e6e6e6' }}>Plugin updates available</strong>
        <button
          onClick={() => setVisible(false)}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '16px' }}
        >
          ✕
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {updates.map(u => (
          <li key={u.name} style={{ margin: '4px 0' }}>
            <strong>{u.name}</strong> v{u.current} → v{u.latest}
            <a
              href={`https://github.com/${REPO}/releases/tag/${u.tag}`}
              target="_blank"
              style={{ color: '#58a6ff', marginLeft: '6px' }}
            >
              Release
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default defineWidget({
  parent: "center-pane",
  position: 9999,
  render: () => <UpdateToast />,
})
