# Trilium Update Checker

A widget that checks for plugin updates by comparing installed versions against GitHub release tags.

## How It Works

1. On load, it fetches tags from the GitHub repository.
2. Compares each plugin's installed version against the latest tag (e.g. `outliner@1.1.0`).
3. If a newer version exists, a toast notification appears in the bottom-right corner.
4. Checks once every 24 hours (cached via localStorage).

## How to Use

1. Create a new **Code Note** in Trilium.
2. Set the note type to `JSX`.
3. Paste the plugin code into the note.
4. Add the label `#widget` to that note.
5. Refresh Trilium.

## How to Update a Plugin

1. Click the **Release** link in the toast notification.
2. Copy the latest plugin code from the release page.
3. Paste it into the existing Code Note in Trilium, replacing the old code.
4. Refresh Trilium.

## How It Detects Installed Plugins

Each plugin registers its name and version to localStorage on load (e.g. `trilium-plugin-outliner: "1.0.0"`). The update checker automatically discovers all registered plugins and compares their versions against GitHub tags. No manual configuration needed.
