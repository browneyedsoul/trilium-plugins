# Trilium Plugins

## Plugins

| \ | Name | Portal |
|---|------|--------|
| <img src="https://raw.githubusercontent.com/browneyedsoul/trilium-plugins/main/plugins/outliner/public/logo.svg" width="75" height="75" /> | Trilium Outliner | [Link](https://github.com/browneyedsoul/trilium-plugins/tree/main/plugins/outliner) |
| <img src="https://raw.githubusercontent.com/browneyedsoul/trilium-plugins/main/plugins/update-checker/public/logo.svg" width="75" height="75" /> | Trilium Update Checker | [Link](https://github.com/browneyedsoul/trilium-plugins/tree/main/plugins/update-checker) |

## Update Checker

### How to Install

To receive update notifications for installed plugins:

1. Create a new **Code Note** in Trilium.
2. Set the note type to **JSX**.
3. Paste the [update-checker code](https://github.com/browneyedsoul/trilium-plugins/tree/main/plugins/update-checker/trilium-update-checker.jsx) into the note.
4. Add the label `#widget` to that note.
5. Refresh Trilium.

Installed plugins automatically register their versions. When a newer version is released, a toast notification will appear in the bottom-right corner with a link to the release page.

### How to Update a Plugin

1. Click the **Release** link in the toast notification.
2. Copy the latest plugin code from the release page.
3. Paste it into the existing Code Note in Trilium, replacing the old code.
4. Refresh Trilium.
