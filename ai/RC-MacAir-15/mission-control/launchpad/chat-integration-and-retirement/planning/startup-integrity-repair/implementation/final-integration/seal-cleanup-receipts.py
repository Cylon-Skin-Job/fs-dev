"""Seal safe cleanup failure and bounded readonly verification after interval end."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,shutil,sys,tempfile
BASE=Path(__file__).resolve().parents[1]
sha=lambda raw:hashlib.sha256(raw).hexdigest()
assert len(sys.argv)==3
root=Path(sys.argv[1]);nonce=sys.argv[2]
assert not root.is_symlink() and root.resolve().parent==Path(tempfile.gettempdir()).resolve()
assert root.name.startswith('chat-ar-final-cleanup-')
marker=root/'.chat-ar-cleanup-owned.json';identity=json.loads(marker.read_text())
assert identity['nonce']==nonce and identity['owner']=='/root/startup_integrity_repair_orchestrator'
before=json.loads((root/'cleanup-before.json').read_text());after=json.loads((root/'cleanup-after.json').read_text())
fresh=json.loads((root/'post-cleanup-current-protection-and-integrity.json').read_text())
attribute=json.loads((root/'developer-db-attribution.json').read_text())
end=json.loads((root/'protected-interval-end.json').read_text())
assert after['proofRoot']==str(root) and after['proofNonce']==nonce
assert after['olderUnchanged'] and not after['failure'] and not after['remainingRoots']
assert len(after['removedRoots'])==10 and set(after['removedRoots'])==set(before['roots'])
assert len(before['markerChecks'])==12 and before['safeRuntimeArtifactHashesVerified']==34 and before['negativeArchiveHashesVerified']==22
assert before['protected']==after['protectedBefore']
assert before['older']==after['olderBefore']==after['olderAfter'] and len(after['olderAfter'])==9
assert not after['protectedUnchanged']
deltas=[key for key in after['protectedBefore'] if after['protectedBefore'][key]!=after['protectedAfter'][key]]
assert deltas==['developmentDb']
assert fresh['freshProtectedUnchanged'] and fresh['matchesInitialAfterTuple']
assert fresh['protectedBefore']==fresh['protectedAfter']==after['protectedAfter']
assert fresh['readOnlySqliteQuickCheckPassed'] and fresh['databasePhysicalHashStableDuringReadOnlyCheck']
assert fresh['observedDeveloperDbMtimePrecedesActualDeletionBoundary'] and fresh['knownOlderIdentitiesMatchInitialAfter'] and fresh['olderCount']==9
assert fresh['oldInitialBaselineLogicalSnapshotAvailable'] is False
assert attribute['developerDbOpenHandles'][0]['pid']==77007 and len(attribute['developerDbOpenHandles'])==1
writer=attribute['safeWriterProcessIdentities'][0]
assert writer['pid']==77007 and writer['ppid']==77002 and writer['isDeveloperServerCommand']
assert writer['commandSha256']==next(p['commandSha256'] for p in after['olderAfter'] if p['pid']==77007)
assert end['event']=='PROTECTED_INTERVAL_ENDED' and end['oldLogicalEqualityUnproved'] and end['originalFailedReceiptNotRewritten']
assert not any(Path(p).exists() for p in after['removedRoots'])
dest=BASE/'final-integration/cleanup-sealed';dest.mkdir(exist_ok=False)
files=[]
for name in ['.chat-ar-cleanup-owned.json','cleanup-before.json','cleanup-after.json','developer-db-attribution.json','post-cleanup-current-protection-and-integrity.json','protected-interval-end.json']:
 source=root/name;copied=dest/name;copied.write_bytes(source.read_bytes())
 assert sha(source.read_bytes())==sha(copied.read_bytes())
 files.append({'source':str(source),'path':str(copied),'sha256':sha(copied.read_bytes()),'bytes':copied.stat().st_size})
record={'at':datetime.now(timezone.utc).isoformat(),'intervalEnd':end['at'],'initialProtectedBoundaryStarted':after['boundaryStarted'],'initialAfterAt':after['at'],'sealedAfterIntervalEnd':True,'files':files,'markerNonce':nonce,'removedRoots':after['removedRoots'],'initialCleanupExitCode':1,'initialProtectedUnchanged':False,'initialPhysicalDeltaScopes':deltas,'freshCurrentProtectedUnchanged':True,'freshReadOnlyQuickCheckPassed':True,'olderUnchanged':True,'observedDbWritePrecedesDeletionBoundary':True,'oldLogicalEqualityClaimed':False,'noPrivateDatabaseOrConfigurationCopy':True,'temporaryReceiptRoot':str(root),'temporaryReceiptRootRemoval':'verified marker/nonce and hash-identical six safe receipt copies then deletion','finalIndependentDisposition':'pending active reviewer; no initial all4 pass inferred'}
(dest/'SEALED-MANIFEST.json').write_text(json.dumps(record,indent=2)+'\n')
assert json.loads(marker.read_text())['nonce']==nonce
shutil.rmtree(root);assert not root.exists()
record['temporaryReceiptRootRemoved']=True
(dest/'SEALED-MANIFEST.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'manifestPath':str(dest/'SEALED-MANIFEST.json'),'sha256':sha((dest/'SEALED-MANIFEST.json').read_bytes()),'temporaryReceiptRootRemoved':True,'ownedRootsRemoved':len(after['removedRoots']),'initialCleanupExitCode':1,'initialProtectedUnchanged':False,'freshCurrentProtectedUnchanged':True,'olderUnchanged':True,'oldLogicalEqualityClaimed':False}))
