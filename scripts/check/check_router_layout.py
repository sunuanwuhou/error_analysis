from __future__ import annotations

import ast
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTERS_DIR = ROOT / 'app' / 'routers'

EXPECTED_ROUTES: dict[tuple[str, str], str] = {
    ('GET', '/health'): 'app.routers.web.health',
    ('GET', '/'): 'app.routers.web.root',
    ('GET', '/legacy'): 'app.routers.web.legacy_root',
    ('GET', '/shenlun'): 'app.routers.web.shenlun_root',
    ('GET', '/v51'): 'app.routers.web.new_frontend_root',
    ('GET', '/v53'): 'app.routers.web.new_frontend_root',
    ('GET', '/v51/{path:path}'): 'app.routers.web.new_frontend_spa',
    ('GET', '/v53/{path:path}'): 'app.routers.web.new_frontend_spa',
    ('GET', '/login'): 'app.routers.web.login_page',
    ('GET', '/api/public-entry'): 'app.routers.web.public_entry',
    ('GET', '/api/runtime-info'): 'app.routers.web.runtime_info',
    ('POST', '/api/auth/register'): 'app.routers.auth.register',
    ('POST', '/api/auth/login'): 'app.routers.auth.login',
    ('POST', '/api/auth/logout'): 'app.routers.auth.logout',
    ('GET', '/api/me'): 'app.routers.auth.me',
    ('GET', '/api/backup'): 'app.routers.backup.get_backup',
    ('PUT', '/api/backup'): 'app.routers.backup.put_backup',
    ('POST', '/api/backup/chunk/init'): 'app.routers.backup.init_backup_chunk_upload',
    ('PUT', '/api/backup/chunk/{upload_id}/part'): 'app.routers.backup.put_backup_chunk_part',
    ('POST', '/api/backup/chunk/complete'): 'app.routers.backup.complete_backup_chunk_upload',
    ('POST', '/api/backup/chunk/download/init'): 'app.routers.backup.init_backup_chunk_download',
    ('GET', '/api/backup/chunk/download/{download_id}/part'): 'app.routers.backup.get_backup_chunk_download_part',
    ('POST', '/api/origin-status'): 'app.routers.backup.put_origin_status',
    ('GET', '/api/local-backups'): 'app.routers.backup.list_local_backups',
    ('POST', '/api/local-backups/create'): 'app.routers.backup.create_local_backup',
    ('POST', '/api/local-backups/restore'): 'app.routers.backup.restore_local_backup',
    ('GET', '/api/local-backups/{backup_id}/download'): 'app.routers.backup.download_local_backup',
    ('DELETE', '/api/local-backups/{backup_id}'): 'app.routers.backup.delete_local_backup',
    ('POST', '/api/ai/analyze-entry'): 'app.routers.ai.analyze_entry',
    ('POST', '/api/ai/ocr-image'): 'app.routers.ai.ocr_image',
    ('POST', '/api/images'): 'app.routers.images.upload_image',
    ('GET', '/api/images/{sha256}'): 'app.routers.images.get_image',
    ('DELETE', '/api/images/{sha256}/unref'): 'app.routers.images.unref_image',
    ('GET', '/api/sync'): 'app.routers.sync.sync_pull',
    ('POST', '/api/sync'): 'app.routers.sync.sync_push',
    ('POST', '/api/practice/log'): 'app.routers.practice.create_practice_log',
    ('POST', '/api/practice/attempts/batch'): 'app.routers.practice.save_practice_attempts',
    ('GET', '/api/practice/attempts'): 'app.routers.practice.list_practice_attempts',
    ('GET', '/api/practice/attempts/summary'): 'app.routers.practice.list_practice_attempt_summaries',
    ('GET', '/api/practice/daily'): 'app.routers.practice.get_practice_daily',
    ('GET', '/api/practice/workbench'): 'app.routers.practice.get_practice_workbench',
    ('GET', '/api/practice/insights'): 'app.routers.practice.get_practice_insights',
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
}

METHOD_DECORATORS = {'get': 'GET', 'post': 'POST', 'put': 'PUT', 'delete': 'DELETE', 'patch': 'PATCH'}


def _extract_route_path(decorator: ast.Call) -> str | None:
    if decorator.args and isinstance(decorator.args[0], ast.Constant) and isinstance(decorator.args[0].value, str):
        return decorator.args[0].value
    for keyword in decorator.keywords:
        if keyword.arg == 'path' and isinstance(keyword.value, ast.Constant) and isinstance(keyword.value.value, str):
            return keyword.value.value
    return None


def _collect_routes_from_module(path: Path) -> list[tuple[str, str, str]]:
    module_name = f"app.routers.{path.stem}"
    source = path.read_text(encoding='utf-8-sig')
    tree = ast.parse(source, filename=str(path))
    routes: list[tuple[str, str, str]] = []

    for node in tree.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        endpoint_name = f'{module_name}.{node.name}'
        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call):
                continue
            func = decorator.func
            if not isinstance(func, ast.Attribute):
                continue
            if not isinstance(func.value, ast.Name) or func.value.id != 'router':
                continue
            method = METHOD_DECORATORS.get(func.attr.lower())
            if not method:
                continue
            path_value = _extract_route_path(decorator)
            if not path_value:
                continue
            routes.append((method, path_value, endpoint_name))

    return routes


def main() -> None:
    actual: dict[tuple[str, str], str] = {}
    duplicates: dict[tuple[str, str], list[str]] = defaultdict(list)

    for router_file in sorted(ROUTERS_DIR.glob('*.py')):
        if router_file.name == '__init__.py':
            continue
        for method, route_path, endpoint in _collect_routes_from_module(router_file):
            key = (method, route_path)
            if key in actual:
                duplicates[key].append(endpoint)
            actual[key] = endpoint

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
            lines.append(f'- Duplicates: {dict(duplicates)}')
        if missing:
            lines.append(f'- Missing: {missing}')
        if wrong:
            lines.append(f'- Wrong endpoint mapping: {wrong}')
        if extra:
            lines.append(f'- Extra API routes: {extra}')
        raise SystemExit('\n'.join(lines))

    print('Router layout check passed (static parse):')
    print(f'- Expected API+web routes: {len(EXPECTED_ROUTES)}')
    print(f'- Registered routes checked: {len(actual)}')


if __name__ == '__main__':
    main()
