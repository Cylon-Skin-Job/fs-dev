"""Seal safe cleanup receipts after the coordinated protected interval ends."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,shutil,sys,tempfile
BASE=Path(__file__).resolve().parents[1]
sha=lambda raw:hashlib.sha256(raw).hexdigest()
assert len(sys.argv)==3
root=Path(sys.argv[1]);nonce=sys.argv[2]
assert not root.is_symlink() and root.resolve().parent==Path(tempfile.gettempdir()).resolve()
assert root.name.startswith('chat-ar-final-cleanup-')
marker=root/'.chat-ar-cleanup-owned.json'
identity=json.loads(marker.read_text());assert identity['nonce']==nonce and identity['owner']=='/root/startup_integrity_repair_orchestrator'
before=json.loads((root/'cleanup-before.json').read_text());after=json.loads((root/'cleanup-after.json').read_text())
assert after['proofRoot']==str(root) and after['proofNonce']==nonce
assert after['protectedUnchanged'] and after['olderUnchanged'] and not after['failure'] and not after['remainingRoots']
assert len(after['removedRoots'])==10 and set(after['removedRoots'])==set(before['roots'])
assert len(before['markerChecks'])>=10 and before['safeRuntimeArtifactHashesVerified']==34 and before['negativeArchiveHashesVerified']==22
assert before['protected']==after['protectedBefore']==after['protectedAfter']
assert before['older']==after['olderBefore']==after['olderAfter']
assert not any(Path(p).exists() for p in after['removedRoots'])
dest=BASE/'final-integration/cleanup-sealed';dest.mkdir(exist_ok=False)
files=[]
for name in ['.chat-ar-cleanup-owned.json','cleanup-before.json','cleanup-after.json']:
 source=root/name;copied=dest/name;copied.write_bytes(source.read_bytes())
 assert sha(source.read_bytes())==sha(copied.read_bytes())
 files.append({'source':str(source),'path':str(copied),'sha256':sha(copied.read_bytes()),'bytes':copied.stat().st_size})
record={'at':datetime.now(timezone.utc).isoformat(),'intervalEnd':after['at'],'protectedBoundaryStarted':after['boundaryStarted'],'sealedAfterIntervalEnd':True,'files':files,'markerNonce':nonce,'removedRoots':after['removedRoots'],'protectedUnchanged':True,'olderUnchanged':True,'noPrivateDatabaseOrConfigurationCopy':True,'temporaryReceiptRoot':str(root),'temporaryReceiptRootRemoval':'verified marker/nonce and hash-identical safe receipt copies then deletion'}
(dest/'SEALED-MANIFEST.json').write_text(json.dumps(record,indent=2)+'\n')
assert json.loads(marker.read_text())['nonce']==nonce
shutil.rmtree(root);assert not root.exists()
record['temporaryReceiptRootRemoved']=True
(dest/'SEALED-MANIFEST.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'manifestPath':str(dest/'SEALED-MANIFEST.json'),'sha256':sha((dest/'SEALED-MANIFEST.json').read_bytes()),'temporaryReceiptRootRemoved':True,'ownedRootsRemoved':len(after['removedRoots']),'protectedUnchanged':True,'olderUnchanged':True}))

