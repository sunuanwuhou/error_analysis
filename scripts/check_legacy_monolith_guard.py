from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parent / 'check' / 'check_legacy_monolith_guard.py'), run_name='__main__')
