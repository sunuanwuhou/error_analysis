from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEGACY_HTML = ROOT / 'xingce_v3' / 'xingce_v3.html'
BUNDLE_MANIFEST = ROOT / 'xingce_v3' / 'legacy-app.bundle.manifest.json'
INLINE_HANDLER_ATTRS = {'onclick', 'oninput', 'onchange', 'onkeydown', 'onsubmit'}
SUPPORTED_DECLARATIVE_EVENTS = {'data-onclick', 'data-oninput', 'data-onchange', 'data-onkeydown'}
REQUIRED_JS_BUNDLES = [
    '/assets/modules/legacy-app.home.bundle.js',
    '/assets/modules/legacy-app.bootstrap.bundle.js',
]


@dataclass
class LegacyHtmlReport:
    link_hrefs: list[str]
    script_srcs: list[str]
    declarative_attrs: list[str]
    inline_handlers: list[tuple[str, str]]


class LegacyHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.link_hrefs: list[str] = []
        self.script_srcs: list[str] = []
        self.declarative_attrs: list[str] = []
        self.inline_handlers: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_map = {name: value for name, value in attrs}
        if tag == 'link' and attr_map.get('href'):
            self.link_hrefs.append(attr_map['href'])
        if tag == 'script' and attr_map.get('src'):
            self.script_srcs.append(attr_map['src'])
        for name, value in attrs:
            if name in SUPPORTED_DECLARATIVE_EVENTS:
                self.declarative_attrs.append(name)
            if name in INLINE_HANDLER_ATTRS and value:
                self.inline_handlers.append((name, value))


class CheckError(RuntimeError):
    pass


def file_sha256(path: Path) -> str:
    digest = sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def parse_legacy_html(path: Path) -> LegacyHtmlReport:
    parser = LegacyHtmlParser()
    parser.feed(path.read_text(encoding='utf-8'))
    return LegacyHtmlReport(
        link_hrefs=parser.link_hrefs,
        script_srcs=parser.script_srcs,
        declarative_attrs=parser.declarative_attrs,
        inline_handlers=parser.inline_handlers,
    )


def assert_path_exists(asset_url: str) -> Path:
    if not asset_url.startswith('/assets/'):
        raise CheckError(f'Unexpected asset URL: {asset_url}')
    asset_path = ROOT / 'xingce_v3' / asset_url.removeprefix('/assets/')
    if not asset_path.exists():
        raise CheckError(f'Missing asset for URL {asset_url}: {asset_path}')
    return asset_path


def main() -> None:
    parser = argparse.ArgumentParser(description='Check the legacy xingce_v3 entry wiring.')
    parser.add_argument('--json', action='store_true', help='Emit JSON summary in addition to checks.')
    args = parser.parse_args()

    if not LEGACY_HTML.exists():
        raise CheckError(f'Legacy entry not found: {LEGACY_HTML}')

    report = parse_legacy_html(LEGACY_HTML)
    unsupported = sorted(set(report.declarative_attrs) - SUPPORTED_DECLARATIVE_EVENTS)
    if unsupported:
        raise CheckError(f'Unsupported declarative attrs found: {unsupported}')
    if report.inline_handlers:
        raise CheckError(f'Inline event handlers still exist: {report.inline_handlers[:5]}')

    asset_paths = []
    for href in report.link_hrefs:
        if href.startswith('/assets/'):
            asset_paths.append(assert_path_exists(href))
    for src in report.script_srcs:
        if src.startswith('/assets/'):
            asset_paths.append(assert_path_exists(src))

    html_text = LEGACY_HTML.read_text(encoding='utf-8')
    if 'mobileSidebarToggle' not in html_text or 'mobileSidebarMask' not in html_text:
        raise CheckError('Mobile sidebar controls are missing from legacy entry.')
    if '/assets/styles/legacy-app.bundle.css' not in html_text:
        raise CheckError('Legacy CSS bundle reference is missing.')
    for bundle_path in REQUIRED_JS_BUNDLES:
        if bundle_path not in html_text:
            raise CheckError(f'Legacy JS split bundle reference is missing: {bundle_path}')

    if not BUNDLE_MANIFEST.exists():
        raise CheckError(f'Bundle manifest missing: {BUNDLE_MANIFEST}')
    bundle_manifest = json.loads(BUNDLE_MANIFEST.read_text(encoding='utf-8'))
    expected_css_path = 'xingce_v3/styles/legacy-app.bundle.css'
    expected_js_path = 'xingce_v3/modules/legacy-app.bundle.js'
    if bundle_manifest.get('css_bundle', {}).get('path') != expected_css_path:
        raise CheckError('Bundle manifest CSS path is out of sync.')
    if bundle_manifest.get('js_bundle', {}).get('path') != expected_js_path:
        raise CheckError('Bundle manifest JS path is out of sync.')
    css_rel = str((ROOT / 'xingce_v3/styles/legacy-app.bundle.css').relative_to(ROOT))
    js_rel = str((ROOT / 'xingce_v3/modules/legacy-app.bundle.js').relative_to(ROOT))
    if bundle_manifest.get('css_bundle', {}).get('sha256') != file_sha256(ROOT / css_rel):
        raise CheckError('Bundle manifest CSS sha256 is stale.')
    if bundle_manifest.get('js_bundle', {}).get('sha256') != file_sha256(ROOT / js_rel):
        raise CheckError('Bundle manifest JS sha256 is stale.')

    manifest = {
        'legacy_html': str(LEGACY_HTML.relative_to(ROOT)),
        'legacy_html_sha256': file_sha256(LEGACY_HTML),
        'asset_files': [str(path.relative_to(ROOT)) for path in asset_paths],
        'asset_sha256': {str(path.relative_to(ROOT)): file_sha256(path) for path in asset_paths},
        'declarative_attr_counts': {name: report.declarative_attrs.count(name) for name in sorted(set(report.declarative_attrs))},
    }

    if args.json:
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
    else:
        print('Legacy entry check passed:')
        print(f"- HTML: {manifest['legacy_html']}")
        for rel in manifest['asset_files']:
            print(f'- Asset OK: {rel}')
        print(f"- Declarative handlers: {sum(manifest['declarative_attr_counts'].values())}")


if __name__ == '__main__':
    main()
