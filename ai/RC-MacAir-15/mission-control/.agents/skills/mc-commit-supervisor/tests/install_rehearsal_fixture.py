"""Install original rehearsal inputs only into the public-created private workspace."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

config = json.loads(Path(sys.argv[1]).read_text())
candidate = Path(config['candidate'])
workspace = Path(config['workspace'])
assert str(candidate).startswith('/private/tmp/mc-s6-')
assert workspace == candidate / 'rehearsal-workspace'
fixture = Path(__file__).parent / 'rehearsal-fixture'
machine = workspace / 'ai' / config['machine']
assert machine.is_dir(), 'public workspace bootstrap must precede fixture install'
capsules = list((machine / 'System/Views').glob('*/manifest.md'))
custom = next(p.parent for p in capsules if 'view-id: custom-viewer' in p.read_text())
app = custom / 'app'
assert not app.exists(), 'never overwrite an installed app'
app.mkdir()
for name in ['index.html', 'checklist-controller.js', 'checklist-view.js', 'checklist.css']:
    shutil.copy2(fixture / name, app / name)
wiki = machine / 'Wiki'
# These are untouched copies of the shipped empty-project template, created
# by the preceding public UI action. No live/source Wiki or registry is copied.
shutil.rmtree(wiki)
wiki.mkdir()
stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
for article, template in [('001-Checklist/001-Checklist_Guide/PAGE.md', 'checklist-guide.md'),
                          ('001-Checklist/002-Navigation_Guide/PAGE.md', 'navigation-guide.md')]:
    page = wiki / article
    page.parent.mkdir(parents=True)
    page.write_text((fixture / template).read_text().replace('2026-10-04T11:40:00Z', stamp))
(wiki / 'PAGE.md').write_text('---\nname: Fixture Wiki\ndescription: Checklist documentation.\n'
    f'metadata:\n  source-files: []\n  last-modified: "{stamp}"\n---\n\n# Fixture Wiki\n\n'
    'Read the Checklist section to learn task completion and navigation.\n')
(machine / 'System/config/cli.json').write_text(json.dumps({'defaultHarness': None, 'harnesses': {}}, indent=2)+'\n')
shutil.rmtree(machine / 'Agents')
(machine / 'Agents').mkdir()
(machine / 'Agents/registry.json').write_text('{"version":"1.0","agents":{}}\n')

def git(*args):
    return subprocess.check_output(['git', '-C', str(candidate), *args])

# Recovery leaves are separate from the live application; no package/code
# owner is replaced merely to obtain binary or staged/unstaged examples.
inputs = candidate / 'rehearsal-inputs'
inputs.mkdir()
readme = candidate / 'README.md'
original = readme.read_bytes()
readme.write_bytes(original + b'\n<!-- disposable staged checkpoint input -->\n')
git('add', '--', 'README.md')
readme.write_bytes(original + b'\n<!-- disposable unstaged checkpoint input -->\n')
binary = inputs / 'checkpoint.bin'
binary.write_bytes(b'staged\0\xff\x80')
git('add', '--', str(binary.relative_to(candidate)))
binary.write_bytes(b'working\0\xfe\x81')
text = inputs / 'staged.txt'
text.write_bytes(b'staged addition\n')
git('add', '--', str(text.relative_to(candidate)))
text.write_bytes(b'working addition\n')
executable = inputs / 'executable.sh'
executable.write_bytes(b'#!/bin/sh\nexit 0\n')
git('add', '--', str(executable.relative_to(candidate)))
executable.chmod(0o751)
odd = inputs / 'odd \'" $ ;\t\n -- path.bin'
odd.write_bytes(b'untracked\0\xff')
link = inputs / 'link'
link.symlink_to('staged-target')
git('add', '--', str(link.relative_to(candidate)))
link.unlink()
link.symlink_to('working-target')
deleted = 'HANDOFF.md'
assert git('ls-files', '--', deleted).strip(), 'selected existing deletion fixture must be tracked'
git('update-index', '--force-remove', '--', deleted)
(candidate / deleted).unlink()
config.update({'custom': str(custom), 'wiki': str(wiki), 'sample_write_time': stamp,
               'recovery_deleted_path': deleted, 'odd_path': str(odd.relative_to(candidate)),
               'fixture_assets': {str(p.relative_to(fixture)): hashlib.sha256(p.read_bytes()).hexdigest()
                                  for p in fixture.iterdir() if p.is_file()}})
Path(sys.argv[1]).write_text(json.dumps(config, indent=2)+'\n')
print(json.dumps({'workspace': str(workspace), 'custom': str(custom), 'wiki': str(wiki),
                  'page_write_utc': stamp, 'deleted': deleted}))
