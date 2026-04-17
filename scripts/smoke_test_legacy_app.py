from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parent / 'release' / 'smoke_test_legacy_app.py'), run_name='__main__')
