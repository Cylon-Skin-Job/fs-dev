"""Read-only S3 binding, preservation, link and artifact validation."""
import ast
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

C = Path(__file__).resolve().parents[3]
R = C.parents[2]
E = Path(__file__).resolve().parent
W = C.parent / 'Wiki'
K = C / '.agents/skills/mc-commit-supervisor'
changed = [K/'references/workflow.md', K/'references/job-template.md', K/'references/wiki-handoff.md',
           C/'review-and-merge-design.md', C/'review-and-merge-handoff.md',
           K/'tests/wiki_fixture.py', K/'tests/test_wiki_handoff.py']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

rows = [{'path': str(p), 'sha256': sha(p), 'lines': len(p.read_bytes().splitlines())} for p in changed]
assert all(row['lines'] < 400 for row in rows), rows
baseline = json.loads((E/'S3-baseline.json').read_text())
assert sha(R/'.git/index') == baseline['index_sha256']
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=R, text=True,
                               env=dict(os.environ, GIT_OPTIONAL_LOCKS='0')).strip()
assert head == baseline['head']
assert Path.cwd().resolve() == C
assert subprocess.check_output(['git','rev-parse','--show-toplevel'], cwd=C, text=True,
                               env=dict(os.environ, GIT_OPTIONAL_LOCKS='0')).strip() == str(R)
preimages = {Path(row['path']): Path(row['preimage']) for row in baseline['files']}
assert (K/'references/workflow.md').read_bytes().startswith(preimages[K/'references/workflow.md'].read_bytes())
assert (K/'references/job-template.md').read_bytes().startswith(preimages[K/'references/job-template.md'].read_bytes())
for p in (C/'review-and-merge-design.md', C/'review-and-merge-handoff.md'):
    headings = lambda text: re.findall(r'^## (.+)$', text, re.MULTILINE)
    assert headings(p.read_text()) == headings(preimages[p].read_text())
preserved = []
for manifest_name in ('S1-current-files.json','S2-current-files.json'):
    for row in json.loads((E/manifest_name).read_text()):
        p = Path(row['path'])
        if p in (K/'references/workflow.md', K/'references/job-template.md'):
            continue
        assert sha(p) == row['sha256'], str(p)
        preserved.append(str(p))
links = []
for p in changed:
    if p.suffix != '.md':
        ast.parse(p.read_text(), filename=str(p))
        continue
    for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', p.read_text()):
        if '://' in link or link.startswith('#'):
            continue
        local = link.split('#')[0].strip('<>')
        if not local:
            continue
        target = (p.parent / local).resolve()
        assert target.exists(), (str(p), link)
        links.append({'from': str(p), 'to': str(target)})
sources = [R/'AGENTS.md', C/'AGENTS.md', C/'session-contract.md', C/'planning/commit-supervisor/SPEC.md',
           E/'approval-receipt.md', C/'.agents/skills/mc-spec-slice-builder/SKILL.md',
           C/'.agents/skills/mc-spec-review-gate/SKILL.md', W/'AGENTS.md', W/'.agents/wiki-session-contract.md']
sources += [W/f'.agents/skills/{name}/SKILL.md' for name in ('wiki-research','wiki-repair','wiki-audit','wiki-update')]
sources += [W/f'000-Wiki_Guidance/{name}/PAGE.md' for name in ('001-Style_Guide','003-Updating_Wikis','004-Audit_Workflow','005-User_Profile_Preferences_and_Design_Philosophy')]
sources += [W/f'005-Enforcement/001-Code_Standards/{name}/PAGE.md' for name in ('000-Code_Standards','001-Architecture_Routing','007-Persistence_And_Metadata','008-Testing_And_Smoke_Slices')]
sources += [W/f'008-Workflows/{name}/PAGE.md' for name in ('001-Sync_Wiki_Context','002-Wiki_Update')]
sources += [R/'fusion-studio-server'/name for name in ('scripts/wiki.js','lib/wiki/audit/run.js','lib/wiki/audit/toc-sync.js','lib/wiki/audit/state.js','lib/wiki/wiki-tree.js','lib/frontmatter/parser.js','lib/frontmatter/index.js','lib/views/index.js','lib/workspace/ai-paths.js')]
sources += [R/'fusion-studio-client'/name for name in ('src/lib/wiki-frontmatter.ts','src/lib/front-matter.ts','node_modules/gray-matter/package.json')]
source_rows = [{'path': str(p), 'sha256': sha(p)} for p in sources]
result = {'cwd': str(C), 'repo': str(R), 'head': head, 'index_unchanged': True,
          's1_s2_prefixes_preserved': True, 'other_accepted_artifacts_preserved': preserved,
          'indexed_h2_names_preserved': True, 'ast': 'pass', 'markdown_links': links,
          'artifacts': rows, 'source_revisions': source_rows}
(E/'S3-current-files.json').write_text(json.dumps(rows,indent=2)+'\n')
(E/'S3-static-checks.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'result':'pass','artifact_count':len(rows),'resolved_links':len(links),
                  'preserved_artifacts':len(set(preserved)), 'largest_file':max(row['lines'] for row in rows)}))
