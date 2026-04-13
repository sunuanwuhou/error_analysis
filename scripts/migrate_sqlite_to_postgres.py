from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parent / 'migration' / 'migrate_sqlite_to_postgres.py'), run_name='__main__')
