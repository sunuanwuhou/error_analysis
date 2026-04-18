from __future__ import annotations

import json
from pathlib import Path
from datetime import datetime, timezone
from hashlib import sha256

ROOT = Path(__file__).resolve().parents[2]
XINGCE = ROOT / 'xingce_v3'
V51_FRONTEND = ROOT / 'v51_frontend'
CORE_PARTIALS = [
    '00-mobile-topbar.html',
    '01-sidebar.html',
    '02-mobile-toggle.html',
    '03-mobile-mask.html',
    '04-main-area.html',
    '24-mobile-bottombar.html',
]

CSS_SOURCES = [
    'styles/main/00-base-reset.css',
    'styles/main/01-sidebar.css',
    'styles/main/02-main-area.css',
    'styles/main/03-tab-bar.css',
    'styles/main/04-left-menu.css',
    'styles/main/05-center-notes.css',
    'styles/main/06-right-errors.css',
    'styles/main/07-stats-breadcrumbs.css',
    'styles/main/08-error-list.css',
    'styles/main/09-error-card.css',
    'styles/main/10-modal-base.css',
    'styles/main/11-claude-modal.css',
    'styles/main/12-quiz-modal.css',
    'styles/main/13-storage-warning.css',
    'styles/main/14-image-preview.css',
    'styles/main/15-image-responsive.css',
    'styles/main/16-per-question-note.css',
    'styles/main/17-dashboard.css',
    'styles/main/18-practice-history.css',
    'styles/main/19-chapter-filter.css',
    'styles/main/20-quiz-skip.css',
    'styles/main/21-chapter-stats.css',
    'styles/main/22-expand-collapse-all.css',
    'styles/main/23-md-toolbar.css',
    'styles/main/24-export-modal.css',
    'styles/main/25-type-rules.css',
    'styles/main/26-difficulty-stars.css',
    'styles/main/27-bulk-actions.css',
    'styles/main/28-stats-tab.css',
    'styles/main/29-directory-management.css',
    'styles/main/30-inline-quiz.css',
    'styles/main/31-right-notes-panel.css',
    'styles/main/32-note-type-tags.css',
    'styles/main/33-note-split-editor.css',
    'styles/main/34-right-note-title-items.css',
    'styles/main/35-ai-workbench-tabs.css',
    'styles/main/36-review-finish-actions.css',
    'styles/main/37-layout-refresh-v31.css',
    'styles/main/38-presentation-polish-v31.css',
    'styles/main/39-print.css',
]

JS_SOURCES = [
    'modules/main/00-event-dispatcher.js',
    'modules/main/01-state.js',
    'modules/main/02-indexeddb.js',
    'modules/main/03-storage-usage.js',
    'modules/main/04-utils.js',
    'modules/main/05-persistence.js',
    'modules/main/06-ai-workbench.js',
    'modules/main/07-image-processing.js',
    'modules/main/08-initial-data.js',
    'modules/main/09-markdown.js',
    'modules/main/10-notes-panel.js',
    'modules/main/11-typed-note-tree.js',
    'modules/main/12-review-engine.js',
    'modules/main/13-quiz-flow.js',
    'modules/main/14-sidebar-render.js',
    'modules/main/15-filters.js',
    'modules/main/16-main-render.js',
    'modules/main/workspace/16a-workspace-actions.js',
    'modules/main/17-error-card-render.js',
    'modules/main/workspace/17a-error-card-actions.js',
    'modules/main/18-crud-modal.js',
    'modules/main/19-import-export.js',
    'modules/main/modal/19a-import-export-core.js',
    'modules/main/20-claude-helper.js',
    'modules/main/21-dashboard-modules.js',
    'modules/main/22-history.js',
    'modules/main/23-md-toolbar.js',
    'modules/main/24-type-detection.js',
    'modules/main/25-quick-print.js',
    'modules/main/26-export-upgrade.js',
    'modules/main/27-backup-restore.js',
    'modules/main/28-vocabulary-bank.js',
    'modules/main/29-quiz-shortcuts.js',
    'modules/main/knowledge/30a-knowledge-tree-state.js',
    'modules/main/knowledge/30b-knowledge-tree-render.js',
    'modules/main/knowledge/30c-knowledge-tree-actions.js',
    'modules/main/30-directory-management.js',
    'modules/main/31-inline-quiz.js',
    'modules/main/32-difficulty-rating.js',
    'modules/main/33-bulk-actions.js',
    'modules/main/34-modal-controls.js',
    'modules/main/36-tab-coordination.js',
    'modules/main/99-bootstrap.js',
    'modules/knowledge-state.js',
    'modules/knowledge-workbench.js',
    'modules/knowledge-workspace.js',
    'modules/knowledge-node-modal.js',
    'modules/data-management.js',
]

JS_VIEW_SPLIT_SOURCES = {
    'home': [
        'modules/main/00-event-dispatcher.js',
        'modules/main/01-state.js',
        'modules/main/02-indexeddb.js',
        'modules/main/03-storage-usage.js',
        'modules/main/04-utils.js',
        'modules/main/05-persistence.js',
        'modules/main/08-initial-data.js',
        'modules/main/09-markdown.js',
        'modules/main/12-review-engine.js',
        'modules/main/13-quiz-flow.js',
        'modules/main/14-sidebar-render.js',
        'modules/main/15-filters.js',
        'modules/main/21-dashboard-modules.js',
        'modules/main/22-history.js',
        'modules/main/24-type-detection.js',
        'modules/main/29-quiz-shortcuts.js',
        'modules/main/36-tab-coordination.js',
        'modules/knowledge-state.js',
        'modules/knowledge-workbench.js',
    ],
    'workspace': [
        'modules/main/10-notes-panel.js',
        'modules/main/11-typed-note-tree.js',
        'modules/main/16-main-render.js',
        'modules/main/workspace/16a-workspace-actions.js',
        'modules/main/17-error-card-render.js',
        'modules/main/workspace/17a-error-card-actions.js',
        'modules/main/27-backup-restore.js',
        'modules/main/knowledge/30a-knowledge-tree-state.js',
        'modules/main/knowledge/30b-knowledge-tree-render.js',
        'modules/main/knowledge/30c-knowledge-tree-actions.js',
        'modules/main/30-directory-management.js',
        'modules/knowledge-workspace.js',
        'modules/data-management.js',
    ],
    'modal': [
        'modules/main/06-ai-workbench.js',
        'modules/main/07-image-processing.js',
        'modules/main/18-crud-modal.js',
        'modules/main/19-import-export.js',
        'modules/main/modal/19a-import-export-core.js',
        'modules/main/20-claude-helper.js',
        'modules/main/23-md-toolbar.js',
        'modules/main/25-quick-print.js',
        'modules/main/26-export-upgrade.js',
        'modules/main/28-vocabulary-bank.js',
        'modules/main/31-inline-quiz.js',
        'modules/main/32-difficulty-rating.js',
        'modules/main/33-bulk-actions.js',
        'modules/main/34-modal-controls.js',
        'modules/knowledge-node-modal.js',
    ],
    'bootstrap': [
        'modules/main/99-bootstrap.js',
    ],
}


def load_v51_partials_manifest() -> list[str]:
    manifest_path = V51_FRONTEND / 'partials-manifest.json'
    return json.loads(manifest_path.read_text(encoding='utf-8'))


def build_partials_bundle(partials: list[str]) -> str:
    chunks = []
    for name in partials:
        source_path = V51_FRONTEND / 'partials' / name
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        chunks.append(source_path.read_text(encoding='utf-8').rstrip())
    return '\n'.join(chunks) + '\n'


def bundle_contents(paths: list[str], comment_prefix: str) -> str:
    built_at = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%SZ')
    chunks = [f'/* Generated by scripts/build_legacy_assets.py at {built_at} */\n']
    for rel in paths:
        source_path = XINGCE / rel
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        content = source_path.read_text(encoding='utf-8')
        chunks.append(f'\n{comment_prefix} BEGIN: {rel} */\n')
        chunks.append(content.rstrip())
        chunks.append(f'\n{comment_prefix} END: {rel} */\n')
    return ''.join(chunks) + '\n'


def file_sha256(path: Path) -> str:
    digest = sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def build_manifest(css_bundle_path: Path, js_bundle_path: Path, view_bundle_paths: dict[str, Path]) -> dict[str, object]:
    manifest = {
        'built_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'css_bundle': {
            'path': str(css_bundle_path.relative_to(ROOT)),
            'sha256': file_sha256(css_bundle_path),
            'sources': CSS_SOURCES,
        },
        'js_bundle': {
            'path': str(js_bundle_path.relative_to(ROOT)),
            'sha256': file_sha256(js_bundle_path),
            'sources': JS_SOURCES,
        },
    }
    manifest['js_view_bundles'] = {
        name: {
            'path': str(path.relative_to(ROOT)),
            'sha256': file_sha256(path),
            'sources': JS_VIEW_SPLIT_SOURCES[name],
        }
        for name, path in view_bundle_paths.items()
    }
    return manifest


def main() -> None:
    css_bundle_path = XINGCE / 'styles' / 'legacy-app.bundle.css'
    js_bundle_path = XINGCE / 'modules' / 'legacy-app.bundle.js'
    manifest_path = XINGCE / 'legacy-app.bundle.manifest.json'
    view_bundle_paths = {
        name: XINGCE / 'modules' / f'legacy-app.{name}.bundle.js'
        for name in JS_VIEW_SPLIT_SOURCES.keys()
    }
    partials_bundle_path = V51_FRONTEND / 'partials.bundle.html'
    deferred_partials_bundle_path = V51_FRONTEND / 'deferred-partials.bundle.html'
    partials_manifest = load_v51_partials_manifest()
    deferred_partials = [name for name in partials_manifest if name not in CORE_PARTIALS]

    css_bundle_path.write_text(bundle_contents(CSS_SOURCES, '/*'), encoding='utf-8')
    js_bundle_path.write_text(bundle_contents(JS_SOURCES, '/*'), encoding='utf-8')
    for name, source_list in JS_VIEW_SPLIT_SOURCES.items():
        view_bundle_paths[name].write_text(bundle_contents(source_list, '/*'), encoding='utf-8')
    partials_bundle_path.write_text(build_partials_bundle(CORE_PARTIALS), encoding='utf-8')
    deferred_partials_bundle_path.write_text(build_partials_bundle(deferred_partials), encoding='utf-8')
    manifest_path.write_text(json.dumps(build_manifest(css_bundle_path, js_bundle_path, view_bundle_paths), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print(f'Wrote {css_bundle_path.relative_to(ROOT)}')
    print(f'Wrote {js_bundle_path.relative_to(ROOT)}')
    for name, path in view_bundle_paths.items():
        print(f'Wrote {path.relative_to(ROOT)}')
    print(f'Wrote {partials_bundle_path.relative_to(ROOT)}')
    print(f'Wrote {deferred_partials_bundle_path.relative_to(ROOT)}')
    print(f'Wrote {manifest_path.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
