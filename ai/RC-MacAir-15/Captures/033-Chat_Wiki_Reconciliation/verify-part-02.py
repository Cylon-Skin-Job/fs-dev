"""Read-only document and preservation checks for Part 2; no application startup."""
import base64, difflib, hashlib, json, re, subprocess
from pathlib import Path
from urllib.parse import unquote
root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
capture = root / 'ai/RC-MacAir-15/Captures/033-Chat_Wiki_Reconciliation'
baseline = json.loads((capture / 'EXECUTION-BASELINE.json').read_text())
records = json.loads((capture / 'PART-02-SNAPSHOTS.json').read_text())
changed = {r['path']: r for r in records}
prior = json.loads((capture / 'PART-01-CHECKS.json').read_text())['candidate_pages']
sha = lambda b: hashlib.sha256(b).hexdigest()
errors = []; counts = {}; warnings = []
def check(kind, ok, detail):
    counts[kind] = counts.get(kind, 0) + 1
    if not ok: errors.append(f'{kind}: {detail}')
pattern = rb'<!--\s*(section-toc|children):start\s*-->.*?<!--\s*\1:end\s*-->'
for item in baseline['pages']:
    old = base64.b64decode(item['content_base64']); current = (root/item['path']).read_bytes()
    check('generated_blocks', re.findall(pattern, old, re.S) == re.findall(pattern, current, re.S) and [m.group(0) for m in re.finditer(pattern, old, re.S)] == [m.group(0) for m in re.finditer(pattern, current, re.S)], item['path'])
    if item['path'] not in changed:
        check('unchanged_articles', sha(current) == prior.get(item['path'], sha(old)), item['path']); continue
    rec = changed[item['path']]; snap = (root/rec['snapshot']).read_bytes()
    check('exact_pre_edit_snapshots', sha(snap) == rec['pre_sha256'] and sha(snap) == prior.get(item['path'], sha(old)), item['path'])
    added = [line[1:] for line in difflib.unified_diff(snap.decode().splitlines(),current.decode().splitlines()) if line.startswith('+') and not line.startswith('+++')]
    check('no_new_ephemeral_refs', not any(re.search(r'SPEC-|Captures/|PART-0', line) for line in added), item['path'])
    check('whitespace', current.endswith(b'\n') and all(not line.rstrip(b'\r\n').endswith((b' ', b'\t')) for line in current.splitlines(True)), item['path'])
for item in baseline['protected_files']:
    p = root/item['path']; check('protected_files', p.is_file() and sha(p.read_bytes()) == item['sha256'], item['path'])
for field in ('approved_spec','preparation_baseline'):
    item=baseline[field]; check('authority_unchanged', sha((root/item['path']).read_bytes()) == item['sha256'], item['path'])
check('revision', subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip() == baseline['head'], 'HEAD')
check('product_inventory', set(subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard','--','fusion-studio-client','fusion-studio-server']).decode().split('\0'))-{''} <= {p['path'] for p in baseline['protected_files']}, 'no new product paths')
node = "const fs=require('fs'),m=require('./fusion-studio-client/node_modules/gray-matter');const paths=JSON.parse(process.argv[1]);process.stdout.write(JSON.stringify(paths.map(p=>({path:p,data:m(fs.readFileSync(p,'utf8')).data}))));"
parsed=json.loads(subprocess.check_output(['node','-e',node,json.dumps(list(changed))],cwd=root,text=True))
for item in parsed:
    p=root/item['path']; data=item['data']; check('frontmatter', bool(data.get('name') and data.get('description') and isinstance(data.get('metadata'),dict)), item['path'])
    for src in data['metadata'].get('source-files',[]):
        target=root/src.replace('<machine>','RC-MacAir-15')
        check('source_paths_exist',target.exists(),src)
        if target.is_dir():
            warnings.append({'source_metadata':src,'classification':'existing directory pointer; Part 6 owns source-metadata normalization'})
        if target.is_file() and target.suffix not in ('.js','.ts','.tsx','.css','.mjs','.cjs'):
            warnings.append({'source_metadata':src,'classification':'existing config pointer; Part 6 owns source-metadata normalization'})
    body=p.read_text(); body=re.sub(r'```.*?```','',body,flags=re.S)
    for url in re.findall(r'(?<!!)\[[^\]]+\]\(([^)]+)\)',body):
        if re.match(r'\w+://',url):
            warnings.append({'external_link_not_fetched':url}); continue
        path,_,fragment=unquote(url).partition('#'); target=(p.parent/path).resolve() if path else p
        check('relative_links', target.is_file(),f'{p}: {url}')
        if fragment and target.is_file():
            headings=re.findall(r'^#{1,6}\s+(.+?)\s*#*$',target.read_text(),re.M)
            slugs=[re.sub(r'[^\w\- ]','',h.lower()).replace(' ','-') for h in headings]
            check('heading_fragments',fragment in slugs,f'{p}: {url}')
result={'counts':counts,'passed':sum(counts.values())-len(errors),'errors':errors,'warnings':warnings,'candidate_pages':{p:sha((root/p).read_bytes()) for p in changed}}
print(json.dumps(result,indent=2)); raise SystemExit(bool(errors))
