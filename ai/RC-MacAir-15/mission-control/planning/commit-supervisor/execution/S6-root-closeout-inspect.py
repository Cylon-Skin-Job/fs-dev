import pathlib,json,hashlib,os,stat,datetime,re,sys
C=pathlib.Path.cwd();R=C.parents[2];E=C/'planning/commit-supervisor/execution';B=E/'S6-closeout';V=C/'jobs/commit-supervisor/rehearsal-20261004-s6/recovery-1'
def load(p):return json.loads(pathlib.Path(p).read_text())
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def leaf(p):
 try:s=p.lstat()
 except FileNotFoundError:return {'exists':False}
 kind='file'if stat.S_ISREG(s.st_mode)else'symlink'if stat.S_ISLNK(s.st_mode)else'directory';d={'exists':True,'kind':kind,'mode':s.st_mode,'dev':s.st_dev,'ino':s.st_ino,'size':s.st_size,'mtime_ns':s.st_mtime_ns}
 if kind in ['file','symlink']:d['sha256']=hashlib.sha256(os.fsencode(os.readlink(p))if kind=='symlink'else p.read_bytes()).hexdigest()
 return d
def pin(a):
 p=pathlib.Path(a['path']);actual=leaf(p)
 for k,v in a.items():
  if k in actual:assert actual[k]==v,(str(p),k)
 if a.get('exists')is False:assert not actual['exists'],str(p)
 if 'sha256'in a:assert sha(p)==a['sha256'],str(p)
def recurse(d):
 if isinstance(d,dict):
  if 'path'in d and ('sha256'in d or 'exists'in d):pin(d)
  for a in d.values():recurse(a)
 elif isinstance(d,list):
  for a in d:recurse(a)
m=load(E/'S6-closeout-manifest.json');freeze=load(B/'review-freeze.json');assert sha(E/'S6-closeout-manifest.json')=='5a3cd688a30036095af7da276907543961331fe3a11bd7fa2db89486d98357aa';assert sha(B/'review-freeze.json')=='80647ab62331481e469d48b3369f1115b02dab85e6d627b03a83b87d0b2ce3a0'
for k in ['authority','changed_documentation','actual_domain_raw','closeout_raw']:recurse(m[k])
recurse(freeze['own_raw']);recurse(freeze['changed_documentation']);recurse(freeze['manifest'])
owner=load(B/'ownership-and-preimages.json');write=load(B/'write-receipt.json');page=pathlib.Path(owner['owned_docs'][-1]['source']);version=pathlib.Path(owner['future_exclusive_version'])
for row in owner['owned_docs']:
 pre=pathlib.Path(row['preimage']);assert pre.read_bytes()and sha(pre)==row['before']['sha256']==row['preimage_sha256'];assert stat.S_IMODE(pathlib.Path(row['source']).stat().st_mode)==stat.S_IMODE(row['before']['mode'])
assert version.read_bytes()==pathlib.Path(owner['owned_docs'][-1]['preimage']).read_bytes();assert set(p.name for p in version.parent.iterdir()if p.is_file())==set(owner['existing_complete_versions'])|{version.name}
for n,d in owner['existing_complete_versions'].items():assert leaf(version.parent/n)==d
assert owner['observed_local_clock'].startswith('2026-10-04T14:14:58.')and version.name=='2026-10-04-141458.md';assert owner['declared_at_utc']<write['version_copy_completed_utc']<write['wiki_write_completed_utc'];assert write['wiki_metadata_last_modified']=='2026-10-04T21:16:40Z'
checks=load(B/'documentation-checks.json');assert len(checks['raw_commands'])==8
for d in checks['raw_commands']:
 assert d['exit_code']==0 and d['started']<=d['finished'];recurse(d)
metadata=checks['gray_matter_data'];assert metadata['metadata']['source-files']==['restart-fusion.sh','scripts/fusion-restart.mjs','scripts/fusion-restart-target.mjs','scripts/fusion-restart-processes.mjs','scripts/fusion-restart-probe.mjs']
for n,d in write['source_files'].items():assert leaf(pathlib.Path(n))==d
before=load(B/'before.json');after=load(B/'after.json');changes=[]
for n in sorted(set(before['source'])|set(after['source'])):
 a=before['source'].get(n,{'exists':False});b=after['source'].get(n,{'exists':False})
 if a!=b:changes.append({'path':n,'kind':'added'if not a.get('exists')else'removed'if not b.get('exists')else'modified'})
allowed={str(pathlib.Path(a['source']).relative_to(R))for a in owner['owned_docs']}|{str(version.relative_to(R))};rootpaths={str((E/n).relative_to(R))for n in ['S6-full-acceptance-packet-draft.md','SPEC-final-preservation-check.py','SPEC-final-static-checks.py']}
assert set(x['path']for x in changes)==allowed|rootpaths;assert len(changes)==11
for k in ['source_caches','candidate','private_profile']:assert before[k]==after[k],k
assert len(before['source_caches'])==193 and len(before['candidate']['paths'])==4353 and len(before['private_profile'])==460
for repo in ['source','candidate']:
 for k in ['head','refs','stage','flags','config','remotes','reflogs']:
  a,b=before['git'][repo][k],after['git'][repo][k];assert pathlib.Path(a['stdout']['path']).read_bytes()==pathlib.Path(b['stdout']['path']).read_bytes(),(repo,k)
 assert before['git'][repo]['physical_index']==after['git'][repo]['physical_index']
for n,d in before['source_caches'].items():assert leaf(R/n)==d,n
for n,d in before['protected_storage'].items():
 a=after['protected_storage'][n];current=leaf(pathlib.Path(n));assert all(d.get(k)==a.get(k)==current.get(k)for k in ['exists','kind','mode','dev','ino']),n
# Check retained current check bindings independently; no broad suite rerun at this gate.
for label in ['Python55_reuse','Node17_reuse']:assert checks[label]
# Exact dependency filename is obtained from the raw documented binding rather than guessed.
raw=checks['Python55_reuse']['raw'];recurse(raw)
criteria=load(B/'criterion-map-v2.json');assert len(criteria['criteria'])==19 and len(criteria['original15_mapping'])==15
neutral=load(B/'deviations-neutral-v3.json');assert len(neutral['entries'])==85
proc=load(B/'process-preservation.json');recurse(proc['raw_receipt']);assert proc['prior_protected13_identity_exact']
out={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actor':'/root','scope':'Independent frozen S6 documentation/full raw manifest inspection; own gate and root acceptance still separate','manifest_sha256':sha(E/'S6-closeout-manifest.json'),'freeze_sha256':sha(B/'review-freeze.json'),'authority_records':len(m['authority']),'current_changed_doc_version_leaves':8,'domain_raw_fingerprints_checked':len(m['actual_domain_raw']),'complete_preimages':7,'exclusive_version':str(version),'prior_versions_unchanged':len(owner['existing_complete_versions']),'source_snapshot_changes':changes,'all_other_snapshot_leaves_exact':True,'source_cache193_current_exact':True,'candidate4353_before_after_exact':True,'private_profile460_before_after_exact':True,'narrow_raw_commands':8,'original_criteria':15,'detailed_criteria':19,'neutral_contextual_entries':85,'process_proof_raw_pins_checked':True,'protected_storage11_current_identity_exact':True,'current_source_index':sha(R/'.git/index'),'read_coverage':'Full current article, all six doc diffs+clarifications, full own reviewer assignment, readbacks/edit helpers, ownership/write/preimages/current source mechanics; raw manifest/snapshots/commands full hashes/structures locally inspected','pending':'Own reviewer native END/full report and separate root full-S6 gate, final suites and whole-SPEC gate'}
(E/'S6-root-closeout-readback.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({k:v for k,v in out.items()if k!='source_snapshot_changes'},indent=2))
