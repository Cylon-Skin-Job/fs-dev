"""Run only after final reviewer reads retained roots and parent coordinates freeze."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, os, shutil, subprocess, tempfile, uuid, sys

BASE = Path(__file__).resolve().parents[1]
REPO = Path('/Users/rccurtrightjr./projects/fs-dev')
FINAL = BASE / 'final-integration'
INVENTORY = BASE / 'R3/whole-builder-gate-20261006T082447Z/RETAINED-EXTERNAL-ROOTS.json'
sha = lambda data: hashlib.sha256(data).hexdigest()
now = lambda: datetime.now(timezone.utc).isoformat()
def file_hash(p):
    return sha(p.read_bytes()) if p.exists() else 'missing'
def tree_hash(root):
    if not root.exists(): return 'missing'
    digest = hashlib.sha256()
    def visit(directory, relative=''):
        for entry in sorted(os.scandir(directory), key=lambda e:e.name):
            rel = relative + '/' + entry.name if relative else entry.name
            if entry.is_dir(follow_symlinks=False): visit(entry.path, rel)
            elif entry.is_file(follow_symlinks=False):
                digest.update(rel.encode()); digest.update(b'\0'); digest.update(Path(entry.path).read_bytes()); digest.update(b'\0')
            else: digest.update(rel.encode()); digest.update(b'\0non-regular\0')
    visit(root)
    return digest.hexdigest()
def protected():
    return {'developmentDb':file_hash(REPO/'fusion-studio-server/data/fusion.db'),
            'normalProfileDb':file_hash(Path.home()/'Library/Application Support/Fusion Studio/server-data/fusion.db'),
            'developerWorkspace':tree_hash(REPO/'ai/RC-MacAir-15'),
            'repositoryPlaywrightOutput':tree_hash(REPO/'fusion-studio-client/test-results')}
def processes():
    lines=subprocess.run(['ps','-axo','pid=,ppid=,lstart=,command='],check=True,capture_output=True,text=True).stdout.splitlines()
    result=[]
    for line in lines:
        fields=line.strip().split(None,7)
        if len(fields)==8:
            result.append({'pid':int(fields[0]),'ppid':int(fields[1]),'start':' '.join(fields[2:7]),'command':fields[7]})
    return result
def safe_process(p):
    return {k:v for k,v in p.items() if k!='command'} | {'commandSha256':sha(p['command'].encode())}

assert sys.argv[1:] == ['--execute-reviewed'], 'No implicit cleanup; explicit reviewed execution argument required'
release=json.loads((FINAL/'RAW-EVIDENCE-REVIEWED-CLEANUP-RELEASE.json').read_text())
assert release['rawEvidenceReviewed'] is True and release['parentProtectedFreezeConfirmed'] is True
assert sha(INVENTORY.read_bytes()) == '0892ddc646e7f53fe9e1e022e0cd698a5c7bd3b742513c5e22cd544d6aa26654'
inventory=json.loads(INVENTORY.read_text())
tmp=Path(tempfile.gettempdir()).resolve(); roots=[]; marker_checks=[]
for r in inventory['roots']:
    p=Path(r['root'])
    if not p.exists():
        assert not r['exists'], 'retained root disappeared before reviewed cleanup'
        continue
    assert r['exists'] and not p.is_symlink() and p.resolve().parent==tmp, str(p)
    assert r['markers'], 'ownership missing'
    for m in r['markers']:
        marker=Path(m['path']); assert marker.parent==p and not marker.is_symlink()
        raw=marker.read_bytes(); assert sha(raw)==m['sha256']
        nonce=json.loads(raw)['nonce'] if m['format']=='json nonce projection' else raw.decode().strip()
        assert nonce==m['nonce']; marker_checks.append({'path':str(marker),'nonce':nonce,'sha256':sha(raw)})
    roots.append(p)
assert len(roots)==10
archive=json.loads((FINAL/'negative-control-archive/ARCHIVE-MANIFEST.json').read_text())
for f in archive['files']: assert file_hash(Path(f['archive']))==f['sha256']
runtime=json.loads((BASE/'R3/runtime-complete-20261006T074525Z/RUNTIME-CURRENT-FINGERPRINTS.json').read_text())
for f in runtime['files']: assert file_hash(Path(f['path']))==f['sha256']
records=processes()
references=[safe_process(p) for p in records if any(str(r) in p['command'] or str(r).replace('/private/var/','/var/') in p['command'] for r in roots)]
assert not references, 'live process references a cleanup root; no deletion'
known_older={77002,77007,77021,12886,12892,12904,48636,48653,48666}
older_before=[safe_process(p) for p in records if p['pid'] in known_older]
assert not any(p['pid'] in {57401,57421,57422,57425,57444,49427} for p in records), 'scratch process/collector still present'
proof_root=Path(tempfile.mkdtemp(prefix='chat-ar-final-cleanup-'))
nonce=str(uuid.uuid4()); (proof_root/'.chat-ar-cleanup-owned.json').write_text(json.dumps({'owner':'/root/startup_integrity_repair_orchestrator','nonce':nonce,'purpose':'final cleanup protected evidence output outside protected roots'})+'\n')
before=protected(); started=now()
before_receipt={'at':started,'protected':before,'older':older_before,'roots':[str(r) for r in roots],'markerChecks':marker_checks,'safeRuntimeArtifactHashesVerified':len(runtime['files']),'negativeArchiveHashesVerified':len(archive['files']),'release':release,'processReferences':references}
(proof_root/'cleanup-before.json').write_text(json.dumps(before_receipt,indent=2)+'\n')
removed=[]; failure=None
try:
    for root in roots:
        shutil.rmtree(root); assert not root.exists(); removed.append(str(root))
except BaseException as error:
    failure={'type':type(error).__name__,'fixedMarker':'OWNED_CLEANUP_FAILED'}
finally:
    after=protected(); current=processes(); older_after=[safe_process(p) for p in current if p['pid'] in known_older]
    result={'at':now(),'boundaryStarted':started,'removedRoots':removed,'remainingRoots':[str(r) for r in roots if r.exists()],'protectedBefore':before,'protectedAfter':after,'protectedUnchanged':before==after,'olderBefore':older_before,'olderAfter':older_after,'olderUnchanged':older_before==older_after,'failure':failure,'comparedOnSuccessOrFailure':True,'safeEvidenceRetainedInOwnedImplementation':True,'noDatabaseOrPrivateConfigCopy':True,'noAppInputOrStopOrPublication':True,'proofRoot':str(proof_root),'proofNonce':nonce}
    (proof_root/'cleanup-after.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['at','boundaryStarted','proofRoot','proofNonce','remainingRoots','protectedUnchanged','olderUnchanged','failure']}))
if failure or result['remainingRoots'] or not result['protectedUnchanged'] or not result['olderUnchanged']: sys.exit(1)
