from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parent / 'migration' / 'normalize_escaped_filenames.py'), run_name='__main__')
