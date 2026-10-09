from pathlib import Path
import hashlib,json,os,subprocess,re,stat,difflib,tomllib
c=Path.cwd();r=c.parents[2];e=c/'planning/commit-supervisor/execution';base=json.loads((e/'S4-race-baseline.json').read_text());owned={p['path'] for p in base['preimages']}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
latest=[]
for old in base['accepted_latest_files']:
 p=Path(old['path']); actual=sha(p) if p.exists() else None
 latest.append({'path':str(p),'sha256':actual,'baseline_sha256':old['sha256'],'expected_change':str(p) in owned,'retained':actual==old['sha256']})
assert all(x['retained'] or x['expected_change'] for x in latest)
env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
def git(*args):return subprocess.check_output(['git',*args],cwd=r,env=env,text=True).strip()
index=Path(base['index_path']);identity={'repo':git('rev-parse','--show-toplevel'),'branch':git('branch','--show-current'),'head':git('rev-parse','HEAD'),'index_sha256':sha(index)}
assert all(identity[k]==base[k] for k in identity)
s6=json.loads((e/'S6-prep/entry-baseline.json').read_text());outside=[]
for rel,old in s6['unowned'].items():
 p=r/rel
 if p.is_relative_to(c) or str(p) in owned:continue
 now={'sha256':sha(p) if p.is_file() and not p.is_symlink() else None,'symlink':os.readlink(p) if p.is_symlink() else None,'mode':p.lstat().st_mode if p.exists() or p.is_symlink() else None}
 if now!=old:outside.append({'path':str(p),'before':old,'after':now})
cache=[{'path':rel,'matches':(r/rel).is_file() and sha(r/rel)==old} for rel,old in s6['source_build_caches'].items()]
assert not outside,outside
assert all(x['matches'] for x in cache)
links=[]
for p in [c/'.agents/skills/mc-commit-supervisor/references/runtime-handoff.md',c/'.agents/skills/mc-commit-supervisor/references/workflow.md']:
 for dest in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if '://' in dest or dest.startswith('#'):continue
  target=Path(dest.split('#')[0]);target=target if target.is_absolute() else p.parent/target
  links.append({'source':str(p),'target':str(target.resolve()),'exists':target.exists()})
assert all(x['exists'] for x in links)
configs=[c/'.codex/config.toml',*sorted((c/'.codex/agents').glob('*.toml'))]
for p in configs:tomllib.loads(p.read_text())
diffs=[];current=[]
for row in base['preimages']:
 p=Path(row['path']);old=Path(row['saved']);diffs.extend(difflib.unified_diff(old.read_text().splitlines(keepends=True),p.read_text().splitlines(keepends=True),fromfile=str(old),tofile=str(p)))
 current.append({'path':str(p),'sha256':sha(p),'lines':len(p.read_text().splitlines()),'mode':stat.S_IMODE(p.stat().st_mode)})
(e/'S4-race.diff').write_text(''.join(diffs));(e/'S4-race-current-files.json').write_text(json.dumps(current,indent=2)+'\n')
checks={'identity':identity,'latest_accepted':latest,'unowned_outside_controller_files_checked':sum(not (r/p).is_relative_to(c) and str(r/p) not in owned for p in s6['unowned']),'unowned_outside_controller_drifts':outside,'source_build_caches':cache,'markdown_links':links,'toml_parsed':[str(p) for p in configs],'raw_failure_retained':[{'path':x['path'],'matches':sha(Path(x['path']))==x['sha256']} for x in base['raw_failure']]}
assert all(x['matches'] for x in checks['raw_failure_retained'])
(e/'S4-race-static-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps({'identity':identity,'current':current,'accepted_unmodified':sum(x['retained'] for x in latest),'outside_controller_checked':checks['unowned_outside_controller_files_checked'],'outside_drifts':len(outside),'build_cache_checks':len(cache),'links':len(links),'toml':len(configs),'raw_failure_retained':True},indent=2))
