from __future__ import annotations

import ast
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTERS_DIR = ROOT / 'backend' / 'routers'

EXPECTED_ROUTES: dict[tuple[str, str], str] = {
    ('GET', '/health'): 'backend.routers.web.health',
    ('GET', '/'): 'backend.routers.web.root',
    ('GET', '/legacy'): 'backend.routers.web.legacy_root',
    ('GET', '/shenlun'): 'backend.routers.web.shenlun_root',
    ('GET', '/v51'): 'backend.routers.web.new_frontend_root',
    ('GET', '/v53'): 'backend.routers.web.new_frontend_root',
    ('GET', '/v51/{path:path}'): 'backend.routers.web.new_frontend_spa',
    ('GET', '/v53/{path:path}'): 'backend.routers.web.new_frontend_spa',
    ('GET', '/login'): 'backend.routers.web.login_page',
    ('GET', '/api/public-entry'): 'backend.routers.web.public_entry',
    ('GET', '/api/runtime-info'): 'backend.routers.web.runtime_info',
    ('GET', '/new'): 'backend.routers.web.migration_frontend_root',
    ('GET', '/new/{path:path}'): 'backend.routers.web.migration_frontend_spa',
    ('POST', '/api/auth/register'): 'backend.routers.auth.register',
    ('POST', '/api/auth/login'): 'backend.routers.auth.login',
    ('POST', '/api/auth/logout'): 'backend.routers.auth.logout',
    ('GET', '/api/me'): 'backend.routers.auth.me',
    ('GET', '/api/backup'): 'backend.routers.backup.get_backup',
    ('PUT', '/api/backup'): 'backend.routers.backup.put_backup',
    ('POST', '/api/backup/chunk/init'): 'backend.routers.backup.init_backup_chunk_upload',
    ('PUT', '/api/backup/chunk/{upload_id}/part'): 'backend.routers.backup.put_backup_chunk_part',
    ('POST', '/api/backup/chunk/complete'): 'backend.routers.backup.complete_backup_chunk_upload',
    ('POST', '/api/backup/chunk/download/init'): 'backend.routers.backup.init_backup_chunk_download',
    ('GET', '/api/backup/chunk/download/{download_id}/part'): 'backend.routers.backup.get_backup_chunk_download_part',
    ('POST', '/api/origin-status'): 'backend.routers.backup.put_origin_status',
    ('GET', '/api/local-backups'): 'backend.routers.backup.list_local_backups',
    ('POST', '/api/local-backups/create'): 'backend.routers.backup.create_local_backup',
    ('POST', '/api/local-backups/restore'): 'backend.routers.backup.restore_local_backup',
    ('GET', '/api/local-backups/{backup_id}/download'): 'backend.routers.backup.download_local_backup',
    ('DELETE', '/api/local-backups/{backup_id}'): 'backend.routers.backup.delete_local_backup',
    ('POST', '/api/ai/analyze-entry'): 'backend.routers.ai.analyze_entry',
    ('POST', '/api/ai/ocr-image'): 'backend.routers.ai.ocr_image',
    ('POST', '/api/images'): 'backend.routers.images.upload_image',
    ('GET', '/api/images/{sha256}'): 'backend.routers.images.get_image',
    ('DELETE', '/api/images/{sha256}/unref'): 'backend.routers.images.unref_image',
    ('GET', '/api/sync'): 'backend.routers.sync.sync_pull',
    ('POST', '/api/sync'): 'backend.routers.sync.sync_push',
    ('POST', '/api/practice/log'): 'backend.routers.practice.create_practice_log',
    ('POST', '/api/practice/attempts/batch'): 'backend.routers.practice.save_practice_attempts',
    ('GET', '/api/practice/attempts'): 'backend.routers.practice.list_practice_attempts',
    ('GET', '/api/practice/attempts/summary'): 'backend.routers.practice.list_practice_attempt_summaries',
    ('GET', '/api/practice/daily'): 'backend.routers.practice.get_practice_daily',
    ('GET', '/api/practice/workbench'): 'backend.routers.practice.get_practice_workbench',
    ('GET', '/api/practice/insights'): 'backend.routers.practice.get_practice_insights',
    ('POST', '/api/practice/today/start'): 'backend.routers.practice.start_today_training',
    ('GET', '/api/practice/today/current'): 'backend.routers.practice.get_today_training_current',
    ('POST', '/api/practice/today/pause'): 'backend.routers.practice.pause_today_training',
    ('POST', '/api/practice/today/answer'): 'backend.routers.practice.answer_today_training',
    ('POST', '/api/ai/evaluate-answer'): 'backend.routers.ai.evaluate_answer',
    ('POST', '/api/ai/generate-question'): 'backend.routers.ai.generate_question',
    ('POST', '/api/ai/diagnose'): 'backend.routers.ai.diagnose',
    ('POST', '/api/ai/chat'): 'backend.routers.ai.ai_chat',
    ('POST', '/api/ai/module-summary-for-claude'): 'backend.routers.ai.module_summary_for_claude',
    ('POST', '/api/ai/distill-to-node'): 'backend.routers.ai.distill_to_node',
    ('POST', '/api/ai/synthesize-node'): 'backend.routers.ai.synthesize_node',
    ('POST', '/api/ai/discover-patterns'): 'backend.routers.ai.discover_patterns',
    ('POST', '/api/ai/suggest-restructure'): 'backend.routers.ai.suggest_restructure',
    ('GET', '/api/knowledge/search'): 'backend.routers.knowledge.knowledge_search',
    ('GET', '/api/suite-bank/papers'): 'backend.routers.suite_bank.api_suite_bank_papers',
    ('GET', '/api/suite-bank/papers/{paper_id}'): 'backend.routers.suite_bank.api_suite_bank_paper_detail',
    ('GET', '/api/suite-bank/search'): 'backend.routers.suite_bank.api_suite_bank_search',
    ('POST', '/api/suite-bank/practice-records'): 'backend.routers.suite_bank.api_suite_bank_practice_record_post',
    ('GET', '/api/suite-bank/practice-records'): 'backend.routers.suite_bank.api_suite_bank_practice_record_list',
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
    module_name = f"backend.routers.{path.stem}"
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
