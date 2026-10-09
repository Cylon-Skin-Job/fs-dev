"""Repeatable read-only validation of the S2 handoff's static boundaries."""
import ast
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tomllib

c = Path(__file__).resolve().parents[3]
e = c / "planning/commit-supervisor/execution"
rows = json.loads((e / "S2-current-files.json").read_text())
for row in rows:
    path = Path(row["path"])
    assert hashlib.sha256(path.read_bytes()).hexdigest() == row["sha256"], path
    assert len(path.read_text().splitlines()) < 400, path
    if path.suffix == ".py":
        ast.parse(path.read_text())
    if path.suffix == ".toml":
        profile = tomllib.loads(path.read_text())
        assert set(profile) == {"name", "description", "developer_instructions"}, path
    if path.suffix == ".md":
        for target in re.findall(r"\]\(([^)]+)\)", path.read_text()):
            assert (path.parent / target.split("#")[0]).resolve().exists(), (path, target)
for row in json.loads((e / "S1-current-files.json").read_text()):
    path = Path(row["path"])
    content = path.read_bytes()
    if path.name == "workflow.md":
        content = ("\n".join(path.read_text().splitlines()[:129]) + "\n").encode()
    assert hashlib.sha256(content).hexdigest() == row["sha256"], path
config = c / ".codex/config.toml"
assert hashlib.sha256(config.read_bytes()).hexdigest() == "755c39322d94bd17c50597ec90c18c743164425734725b97ddf4e5df6dfc78ee"
assert subprocess.check_output(["git", "rev-parse", "--show-toplevel"], cwd=c, text=True).strip() == "/Users/rccurtrightjr./projects/fs-dev"
assert subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=c, text=True).strip() == "d15792920731f85e45b743519d4af2b807d95a9c"
assert subprocess.check_output(["git", "branch", "--show-current"], cwd=c, text=True).strip() == "agent/exact-workspace-paths"
print(json.dumps({"current_hashes": "pass", "TOML_no_model_fields": "pass", "AST": "pass", "links": "pass", "S1_preservation": "pass", "config_unregistered": "pass", "repository_branch_HEAD": "pass"}, indent=2))
