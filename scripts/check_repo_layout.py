from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).resolve().parent / "check" / "check_repo_layout.py"), run_name="__main__")
