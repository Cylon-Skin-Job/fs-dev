"""Disposable procedure rehearsal, not a production editor or factual scanner.

Coverage subjects and dependency paths are explicitly supplied fixture authority.
The real Wiki CLI owns generated blocks. No real Wiki page is writable here.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess


REPOSITORY = Path(__file__).resolve().parents[7]
WIKI_CLI = REPOSITORY / "fusion-studio-server/scripts/wiki.js"
STAMP = re.compile(r'^  last-modified: "[^"\n]+"$', re.MULTILINE)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def article(name, sources, body):
    paths = "\n".join("    - " + json.dumps(p) for p in sources)
    source_field = "  source-files:\n" + paths if sources else "  source-files: []"
    return (f'---\nname: {json.dumps(name)}\ndescription: "Fixture article."\nmetadata:\n'
            f'{source_field}\n  last-modified: "2026-09-01T01:02:03Z"\n---\n\n{body}\n')


class WikiFixture:
    """Own a fresh disposable tree with explicit subjects and stable sentinels."""
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.wiki = self.root / "live" / "Wiki"
        self.wiki.mkdir(parents=True, exist_ok=False)
        self.source = self.root / "source"
        self.source.mkdir()
        self.commands = []
        self.count = "001-Runtime/001-Count/PAGE.md"
        self.retained = "001-Runtime/002-Consumer/PAGE.md"
        self.heading = "001-Runtime/000-Runtime/PAGE.md"
        self.missing = "001-Runtime/004-New_Capability/PAGE.md"
        for path, data in {"src/count.js": b"exports.count = n => n;\n",
                           "src/consumer.js": b"const {count} = require('./count');\n",
                           "src/owner-new.js": b"exports.owner = 'new';\n",
                           "src/new.js": b"exports.enabled = true;\n"}.items():
            leaf = self.source / path
            leaf.parent.mkdir(parents=True, exist_ok=True)
            leaf.write_bytes(data)
        pages = {
            "000-Guide/PAGE.md": article("Guide", [], "# Guide\n\n<!-- section-toc:start -->\n<!-- section-toc:end -->"),
            self.heading: article("Runtime", [], "# Runtime\n\nHand-written routing survives.\n\n<!-- section-toc:start -->\n<!-- section-toc:end -->"),
            self.count: article("Count", ["src/count.js"], "# Count\n\nCurrent count returns n + 1.\n\nApproved future: a display choice.\n\nOpen choice: display format."),
            self.retained: article("Consumer", ["src/consumer.js"], "# Consumer\n\nThe consumer imports count.\n\n[Count](../001-Count/PAGE.md)"),
            "001-Runtime/003-Owner/PAGE.md": article("Owner", ["src/owner-old.js"], "# Owner\n\nThe owner source is the old path.")}
        for path, body in pages.items():
            leaf = self.wiki / path
            leaf.parent.mkdir(parents=True, exist_ok=True)
            leaf.write_text(body, encoding="utf-8")
        (self.wiki / ".audit-state.json").write_bytes(b'{"live":"sentinel"}\n')
        self.operational_before = (self.wiki / ".audit-state.json").read_bytes()
        self.original_subjects = ["count", "consumer", "renamed-owner", "new-capability"]
        # Manually researched original claim map; not metadata-driven discovery.
        self.claims = {
            "count": {"page": self.count, "sources": ["src/count.js"], "disposition": "repair"},
            "consumer": {"page": self.retained, "sources": ["src/consumer.js", "src/count.js"], "disposition": "retain unchanged"},
            "renamed-owner": {"page": "001-Runtime/003-Owner/PAGE.md", "sources": ["src/owner-old.js", "src/owner-new.js"], "disposition": "repair"},
            "new-capability": {"page": self.missing, "sources": ["src/new.js"], "disposition": "unresolved"}}
        self.sources = {p: digest(self.source / p) for v in self.claims.values() for p in v["sources"]}
        self.pages = {p: digest(self.wiki / p) for p in [*pages, self.missing]}
        self.source_index = REPOSITORY / ".git/index"
        self.real_sentinels = {p: digest(p) for p in [self.source_index, REPOSITORY / "AGENTS.md",
                              REPOSITORY / "ai/RC-MacAir-15/Wiki/.audit-state.json"]}

    def coverage(self, claims=None):
        """Report omitted supplied subjects and absent assigned pages from readback."""
        claims = self.claims if claims is None else claims
        findings = []
        for subject in self.original_subjects:
            claim = claims.get(subject)
            if claim is None:
                findings.append({"subject": subject, "kind": "omitted-subject"})
            elif not (self.wiki / claim["page"]).is_file():
                findings.append({"subject": subject, "kind": "missing-article", "page": claim["page"]})
        return findings

    def assert_sources(self):
        drift = [p for p, expected in self.sources.items() if digest(self.source / p) != expected]
        if drift:
            raise ValueError("source drift requires bounded recheck: " + repr(drift))

    def edit(self, path, proposed, *, substantive=True, version_second=None):
        """Execute guarded fixture replacement with complete exclusive preimage."""
        self.assert_sources()
        if path not in self.pages:
            raise ValueError("unassigned fixture article")
        leaf = self.wiki / path
        before = leaf.read_bytes() if leaf.exists() else None
        if digest(leaf) != self.pages[path]:
            raise ValueError("article collision requires coordination")
        text = proposed.decode("utf-8") if isinstance(proposed, bytes) else proposed
        if before is not None and STAMP.sub("", text) == STAMP.sub("", before.decode("utf-8")):
            return {"changed": False, "page": path, "hash": digest(leaf), "preimage": None}
        snapshot = None
        if substantive and before is not None:
            versions = leaf.parent / ".versions"
            versions.mkdir(exist_ok=True)
            second = version_second or datetime.now().strftime("%Y-%m-%d-%H%M%S")
            suffix = 0
            while True:
                snapshot = versions / (second + (f"-{suffix:02d}" if suffix else "") + ".md")
                try:
                    with snapshot.open("xb") as saved:
                        saved.write(before)
                    break
                except FileExistsError:
                    suffix += 1
            if snapshot.read_bytes() != before:
                raise ValueError("preimage readback failed")
        self.assert_sources()
        if digest(leaf) != self.pages[path]:
            raise ValueError("article changed after snapshot")
        utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        if len(STAMP.findall(text)) != 1:
            raise ValueError("fixture requires one quoted UTC field")
        result = STAMP.sub('  last-modified: "' + utc + '"', text)
        leaf.parent.mkdir(parents=True, exist_ok=True)
        leaf.write_text(result, encoding="utf-8")
        self.pages[path] = digest(leaf)
        return {"changed": True, "page": path, "hash": digest(leaf), "timestamp": utc,
                "preimage": str(snapshot) if snapshot else None,
                "preimage_hash": digest(snapshot) if snapshot else None}

    def stage(self):
        target = self.root / "stage" / "Wiki"
        shutil.copytree(self.wiki, target)
        return target

    def generate(self, wiki):
        command = ["node", str(WIKI_CLI), "audit", str(wiki)]
        result = subprocess.run(command, capture_output=True, text=True,
                                env=dict(os.environ, FUSION_LOCAL_MACHINE="S3-Fixture"))
        self.commands.append({"command": command, "returncode": result.returncode,
                              "stdout": result.stdout, "stderr": result.stderr})
        if result.returncode:
            raise AssertionError(result.stderr)
        return self.commands[-1]

    def import_block(self, stage, page, marker="section-toc"):
        """Import only script-owned bytes, never stage prose or operational state."""
        pattern = re.compile(r"<!-- " + re.escape(marker) + r":start -->.*?<!-- " + re.escape(marker) + r":end -->", re.DOTALL)
        live = (self.wiki / page).read_text(encoding="utf-8")
        staged = (stage / page).read_text(encoding="utf-8")
        blocks = pattern.findall(staged)
        if len(blocks) != 1 or len(pattern.findall(live)) != 1:
            raise ValueError("expected one assigned generated block")
        return self.edit(page, pattern.sub(lambda _: blocks[0], live), substantive=False)

    def parsed(self, page):
        # Same strict YAML dependency as the renderer's front-matter.ts.
        # Server navigation parsing only consumes name/description and has a
        # narrower parser; it cannot certify the authored source-list schema.
        parser = REPOSITORY / "fusion-studio-client/node_modules/gray-matter"
        code = "const fs=require('fs'); const p=require(process.argv[1]); const r=p(fs.readFileSync(process.argv[2],'utf8')); console.log(JSON.stringify({frontmatter:r.data,body:r.content}));"
        command = ["node", "-e", code, str(parser), str(self.wiki / page)]
        result = subprocess.run(command, text=True, capture_output=True, check=True)
        return json.loads(result.stdout)

    def assert_sentinels(self):
        assert (self.wiki / ".audit-state.json").read_bytes() == self.operational_before
        for path, expected in self.real_sentinels.items():
            assert digest(path) == expected, f"real source sentinel changed: {path}"
