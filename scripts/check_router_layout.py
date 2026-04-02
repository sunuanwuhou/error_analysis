from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app

EXPECTED_ROUTES: dict[tuple[str, str], str] = {
    ('GET', '/health'): 'app.routers.web.health',
    ('GET', '/'): 'app.routers.web.root',
    ('GET', '/legacy'): 'app.routers.web.legacy_root',
    ('GET', '/shenlun'): 'app.routers.web.shenlun_root',
    ('GET', '/new'): 'app.routers.web.new_frontend_root',
    ('GET', '/new/{path:path}'): 'app.routers.web.new_frontend_spa',
    ('GET', '/login'): 'app.routers.web.login_page',
    ('GET', '/api/public-entry'): 'app.routers.web.public_entry',
    ('GET', '/api/runtime-info'): 'app.routers.web.runtime_info',
    ('POST', '/api/auth/register'): 'app.routers.auth.register',
    ('POST', '/api/auth/login'): 'app.routers.auth.login',
    ('POST', '/api/auth/logout'): 'app.routers.auth.logout',
    ('GET', '/api/me'): 'app.routers.auth.me',
    ('GET', '/api/backup'): 'app.routers.backup.get_backup',
    ('PUT', '/api/backup'): 'app.routers.backup.put_backup',
    ('POST', '/api/origin-status'): 'app.routers.backup.put_origin_status',
    ('POST', '/api/ai/analyze-entry'): 'app.routers.ai.analyze_entry',
    ('POST', '/api/ai/ocr-image'): 'app.routers.ai.ocr_image',
    ('POST', '/api/images'): 'app.routers.images.upload_image',
    ('GET', '/api/images/{sha256}'): 'app.routers.images.get_image',
    ('DELETE', '/api/images/{sha256}/unref'): 'app.routers.images.unref_image',
    ('GET', '/api/sync'): 'app.routers.sync.sync_pull',
    ('POST', '/api/sync'): 'app.routers.sync.sync_push',
    ('POST', '/api/practice/log'): 'app.routers.practice.create_practice_log',
    ('GET', '/api/practice/daily'): 'app.routers.practice.get_practice_daily',
    ('POST', '/api/ai/evaluate-answer'): 'app.routers.ai.evaluate_answer',
    ('POST', '/api/ai/generate-question'): 'app.routers.ai.generate_question',
    ('POST', '/api/ai/diagnose'): 'app.routers.ai.diagnose',
    ('POST', '/api/ai/chat'): 'app.routers.ai.ai_chat',
    ('POST', '/api/ai/module-summary-for-claude'): 'app.routers.ai.module_summary_for_claude',
    ('POST', '/api/ai/distill-to-node'): 'app.routers.ai.distill_to_node',
    ('POST', '/api/ai/synthesize-node'): 'app.routers.ai.synthesize_node',
    ('POST', '/api/ai/discover-patterns'): 'app.routers.ai.discover_patterns',
    ('POST', '/api/ai/suggest-restructure'): 'app.routers.ai.suggest_restructure',
    ('GET', '/api/knowledge/search'): 'app.routers.knowledge.knowledge_search',
    ('GET', '/api/codex/threads'): 'app.routers.codex.list_codex_threads',
    ('POST', '/api/codex/threads'): 'app.routers.codex.create_codex_thread',
    ('GET', '/api/codex/threads/{thread_id}'): 'app.routers.codex.get_codex_thread',
    ('POST', '/api/codex/threads/{thread_id}/messages'): 'app.routers.codex.create_codex_message',
}


def main() -> None:
    actual: dict[tuple[str, str], str] = {}
    duplicates: dict[tuple[str, str], list[str]] = defaultdict(list)

    for route in app.routes:
        path = getattr(route, 'path', None)
        methods = getattr(route, 'methods', None)
        endpoint = getattr(route, 'endpoint', None)
        if not path or not methods or endpoint is None:
            continue
        endpoint_name = f'{endpoint.__module__}.{endpoint.__name__}'
        for method in sorted(methods):
            if method in {'HEAD', 'OPTIONS'}:
                continue
            key = (method, path)
            if key in actual:
                duplicates[key].append(endpoint_name)
            actual[key] = endpoint_name

    missing = [(key, EXPECTED_ROUTES[key]) for key in EXPECTED_ROUTES if key not in actual]
    wrong = [
        (key, EXPECTED_ROUTES[key], actual[key])
        for key in EXPECTED_ROUTES
        if key in actual and actual[key] != EXPECTED_ROUTES[key]
    ]
    extra = [(key, actual[key]) for key in actual if key not in EXPECTED_ROUTES and key[1].startswith('/api/')]

    if duplicates or missing or wrong or extra:
        lines = ['Router layout check failed.']
        if duplicates:
            lines.append(f'- Duplicates: {duplicates}')
        if missing:
            lines.append(f'- Missing: {missing}')
        if wrong:
            lines.append(f'- Wrong endpoint mapping: {wrong}')
        if extra:
            lines.append(f'- Extra API routes: {extra}')
        raise SystemExit('\n'.join(lines))

    print('Router layout check passed:')
    print(f'- Expected API+web routes: {len(EXPECTED_ROUTES)}')
    print(f'- Registered API routes checked: {len(actual)}')


if __name__ == '__main__':
    main()
