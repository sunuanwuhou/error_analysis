from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parent / 'check' / 'check_archive_names.py'), run_name='__main__')
