"""Read exact Git entry and filesystem state without refreshing the index."""
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess


class SnapshotError(ValueError):
    pass


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode()


def git(repo, *args, data=None, env=None, allowed=(0,)):
    variables = dict(os.environ, GIT_OPTIONAL_LOCKS="0", GIT_LITERAL_PATHSPECS="1")
    # An inherited alternate index or worktree must never redirect this operation.
    for name in ("GIT_INDEX_FILE", "GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR"):
        variables.pop(name, None)
    variables.update(env or {})
    result = subprocess.run(["git", "-C", str(repo), *args], input=data,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=variables)
    if result.returncode not in allowed:
        raise SnapshotError(result.stderr.decode(errors="replace").strip())
    return result.stdout


def repository(path):
    root = Path(path).resolve(strict=True)
    actual = Path(os.fsdecode(git(root, "rev-parse", "--show-toplevel")).strip()).resolve()
    if root != actual:
        raise SnapshotError("repo must name its exact Git root")
    gitdir = Path(os.fsdecode(git(root, "rev-parse", "--absolute-git-dir")).strip()).resolve()
    common = Path(os.fsdecode(git(root, "rev-parse", "--git-common-dir")).strip())
    common = (root / common).resolve() if not common.is_absolute() else common.resolve()
    return {"root": str(root), "git_dir": str(gitdir), "common_dir": str(common)}


def ref_state(repo):
    index = Path(repository(repo)["git_dir"]) / "index"
    branch = git(repo, "symbolic-ref", "-q", "HEAD", allowed=(0, 1)).decode().strip() or None
    return {"head": git(repo, "rev-parse", "HEAD").decode().strip(), "branch": branch,
            "refs_sha256": digest(git(repo, "for-each-ref", "--format=%(refname)%00%(objectname)")),
            "config_sha256": digest(git(repo, "config", "--null", "--list", "--show-origin")),
            "index_file_sha256": digest(index.read_bytes()) if index.exists() else None}


def path_name(value):
    if not isinstance(value, str) or not value or "\0" in value:
        raise SnapshotError("owned paths must be nonempty strings without NUL")
    parts = value.split("/")
    if value.startswith("/") or any(p in ("", ".", "..") or p.lower() == ".git" for p in parts):
        raise SnapshotError("owned paths must be canonical repository-relative leaf paths")
    return value


def safe_leaf(repo, name):
    leaf = Path(repo) / path_name(name)
    parent = leaf.parent
    while parent != Path(repo):
        if parent.is_symlink() or (parent.exists() and not parent.is_dir()):
            raise SnapshotError(f"unsafe parent for {name!r}")
        parent = parent.parent
    return leaf


def worktree(repo, name, payload=None):
    leaf = safe_leaf(repo, name)
    try:
        before = leaf.lstat()
    except FileNotFoundError:
        return {"kind": "missing"}
    if stat.S_ISLNK(before.st_mode):
        data = os.fsencode(os.readlink(leaf))
        state = {"kind": "symlink", "sha256": digest(data)}
    elif stat.S_ISREG(before.st_mode):
        data = leaf.read_bytes()
        state = {"kind": "file", "mode": stat.S_IMODE(before.st_mode), "sha256": digest(data)}
    else:
        raise SnapshotError(f"unsupported directory/submodule/special leaf {name!r}")
    after = leaf.lstat()
    if (before.st_ino, before.st_size, before.st_mtime_ns, before.st_mode) != (
            after.st_ino, after.st_size, after.st_mtime_ns, after.st_mode):
        raise SnapshotError(f"concurrent worktree mutation: {name!r}")
    if payload:
        state["payload"] = payload(data)
    return state


def index_entries(repo):
    entries = {}
    for record in git(repo, "ls-files", "--stage", "-z").split(b"\0"):
        if not record:
            continue
        fields, name = record.split(b"\t", 1)
        mode, oid, stage = fields.decode().split()
        if mode == "160000":
            # Unrelated gitlinks can be fingerprinted; owned ones require a separate recovery method.
            pass
        entries.setdefault(os.fsdecode(name), []).append({"mode": mode, "oid": oid, "stage": int(stage)})
    return entries


def flags(repo):
    return {os.fsdecode(r[2:]): chr(r[0]) for r in git(repo, "ls-files", "-v", "-z").split(b"\0") if r}


def inventory(repo, owned):
    entries = index_entries(repo)
    attributes = flags(repo)
    names = set(entries) | set(owned)
    names.update(os.fsdecode(n) for n in git(repo, "ls-files", "--others", "--exclude-standard", "-z").split(b"\0") if n)
    result = {}
    for name in sorted(names):
        if any(e["mode"] == "160000" for e in entries.get(name, [])):
            if name in owned:
                raise SnapshotError("owned submodules need a separate recovery prerequisite")
            wt = {"kind": "gitlink", "head": git(Path(repo) / name, "rev-parse", "HEAD").decode().strip()} if (Path(repo) / name).is_dir() else {"kind": "missing"}
        else:
            wt = worktree(repo, name)
        result[name] = {"index": entries.get(name, []), "flag": attributes.get(name), "worktree": wt}
    return result


def relevant_state(repo, owned, protected):
    return {"refs": ref_state(repo), "paths": inventory(repo, owned),
            "protected": {p: ref_state(p) for p in protected}}


def semantic(state):
    """Index timestamps/extensions may change, but semantic entries and refs must agree."""
    value = json.loads(json.dumps(state))
    value["refs"].pop("index_file_sha256")
    return value


def unrelated(state, owned):
    return {p: s for p, s in state["paths"].items() if p not in owned}


def assert_isolated(repo, protected):
    identity = repository(repo)
    for other in protected:
        source = repository(other)
        root, src = Path(identity["root"]), Path(source["root"])
        if root == src or root in src.parents or src in root.parents or identity["common_dir"] == source["common_dir"]:
            raise SnapshotError("restore/capture requires a separate disposable clone, not source/shared checkout")
    return identity


def resolve_commit(repo, ref):
    return git(repo, "rev-parse", "--verify", f"{ref}^{{commit}}").decode().strip()
