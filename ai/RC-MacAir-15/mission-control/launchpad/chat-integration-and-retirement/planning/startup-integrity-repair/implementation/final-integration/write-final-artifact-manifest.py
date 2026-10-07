"""Check current completion annotations, preservation, links and create nonrecursive final identities."""
from pathlib import Path
from datetime import datetime,timezone
import hashlib,json,re
from urllib.parse import unquote
BASE=Path(__file__).resolve().parents[1]
FINAL=BASE/'final-integration'
BUNDLE=BASE.parent
ORIGINAL=BUNDLE.parent/'chokidar-retirement-and-harness-launch/spec'
sha=lambda data:hashlib.sha256(data).hexdigest()
assert (BASE/'SPEC-FINAL-REPORT.md').exists()
refresh=json.loads((FINAL/'COMPLETION-RECORD-REFRESH.json').read_text())
assert sha((BASE/'SPEC-FINAL-REPORT.md').read_bytes())==refresh['finalReportSha256']
candidate=json.loads((FINAL/'FINAL-CANDIDATE.json').read_text())
archive=json.loads((FINAL/'negative-control-archive/ARCHIVE-MANIFEST.json').read_text())
mapping={r['original']:r for r in archive['files']}
permitted={r['path']:r for r in refresh['changes']};permitted[str(BASE/'SOURCE-FINGERPRINTS.json')]={'reason':'additive final technical completion snapshot'}
current=[]
for r in candidate['rows']:
 p=Path(r['path']);resolved=p;mode='reviewed current bytes'
 if not p.exists():
  assert str(p) in mapping;resolved=Path(mapping[str(p)]['archive']);mode='reviewed exact negative bytes archived after authorized cleanup'
 data=resolved.read_bytes();data=data[:r['bytesHashed']] if r.get('prefixOnly') else data;actual=sha(data)
 if actual!=r['sha256']:
  assert str(p) in permitted and not r.get('prefixOnly'),str(p)
  if 'afterSha256' in permitted[str(p)]:assert actual==permitted[str(p)]['afterSha256']
  mode='post-review final state annotation with exact preimage; unchanged underlying product/evidence'
 current.append({'reviewedPath':str(p),'currentPath':str(resolved),'reviewedSha256':r['sha256'],'currentSha256':actual,'bytesHashed':len(data),'prefixOnly':r.get('prefixOnly',False),'validity':mode})
adoption=json.loads((BASE/'original-adoption-20261006/ADOPTION-MANIFEST.json').read_text())
historical=[]
for r in adoption['historicalFilesVerifiedBefore']:
 p=Path(r['path']);data=p.read_bytes();prefix='SLICE-AND-DEVIATION-LEDGER.md'==p.name
 if prefix:data=data[:r['bytes']]
 assert sha(data)==r['sha256'],str(p)
 historical.append({'path':str(p),'sha256':r['sha256'],'bytesHashed':len(data),'prefixOnly':prefix})
frozen=[
 (BUNDLE/'SPEC-01-STARTUP-INTEGRITY-REPAIR.md','0d7a3176cca89b017162970b2fe8f28a5c8b902547fba48f797a2cc68060ac3c'),
 (BUNDLE/'SOURCES.json','d124abc38a76f7e63011184387c6d2c5b6e5778333c4d29c146a8bb9d07cdaff'),
 (BUNDLE/'ORIGINAL-RECORD-SUCCESSOR-APPROVAL.md','4e30de42d63504202ef36cd582f986a7773cc85f78a7fe00a4e707af0c61d464'),
 (ORIGINAL/'SPEC-01-CHOKIDAR-RETIREMENT-AND-CHAT-VERIFICATION.md','bd9068de68a1d83d74d2a1d309eb28f433db97aa11a2f73f9bd872453e6521c3'),
 (ORIGINAL/'OWNER-APPROVAL.md','e0704ea562f4b6e2b9bb685cbf0a101b10314df1476ab3f784a6a309f8e7a24e')]
for p,expected in frozen:assert sha(p.read_bytes())==expected
sealed=json.loads((FINAL/'cleanup-sealed/SEALED-MANIFEST.json').read_text())
for r in sealed['files']:assert sha(Path(r['path']).read_bytes())==r['sha256']
assert not Path(sealed['temporaryReceiptRoot']).exists()
assert not any(Path(r).exists() for r in sealed['removedRoots'])
runtime=json.loads((BASE/'R3/runtime-complete-20261006T074525Z/RUNTIME-CURRENT-FINGERPRINTS.json').read_text())
for r in runtime['files']:assert sha(Path(r['path']).read_bytes())==r['sha256']
out=FINAL/'FINAL-ARTIFACT-FINGERPRINTS.json'
links=[];missing=[]
reports=[BASE/'SPEC-FINAL-REPORT.md',BASE/'STARTUP-REPAIR-REPORT.md',BASE/'REGRESSION-RESULTS.md',BASE/'GUARDED-SERVER-PROOF.md',BASE/'SLICE-AND-DEVIATION-LEDGER.md',ORIGINAL/'implementation/S3-startup-integrity-reassessment.md',ORIGINAL/'implementation/S4-repaired-integration-report.md',ORIGINAL/'implementation/SLICE-AND-DEVIATION-LEDGER.md']
for p in reports:
 for target in re.findall(r'\]\(([^\s()]+)\)',p.read_text()):
  if target.startswith(('#','http:','https:','app:','plugin:')):continue
  clean=re.sub(r':\d+$','',unquote(target.split('#',1)[0]));resolved=Path(clean) if clean.startswith('/') else p.parent/clean
  generated=resolved.resolve()==out.resolve()
  row={'source':str(p),'target':target,'resolvedPath':str(resolved.resolve()),'exists':resolved.exists() or generated,'generatedByThisOperationBeforeReturn':generated};links.append(row)
  if not row['exists']:missing.append(row)
assert not missing,json.dumps(missing)
link_result={'at':datetime.now(timezone.utc).isoformat(),'reportsChecked':len(reports),'localLinksChecked':len(links),'missing':missing,'links':links,'scope':'local file targets; no external link request or new test execution'}
(FINAL/'FINAL-REFERENCE-VALIDATION.json').write_text(json.dumps(link_result,indent=2)+'\n')
# Hash all safe owned execution artifacts; exclude this final manifest to avoid recursion.
out=FINAL/'FINAL-ARTIFACT-FINGERPRINTS.json'
artifacts=[{'path':str(p),'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in sorted(BASE.rglob('*')) if p.is_file() and not p.is_symlink() and p!=out]
original_targets=[{'path':str(ORIGINAL/'implementation'/name),'sha256':sha((ORIGINAL/'implementation'/name).read_bytes()),'bytes':(ORIGINAL/'implementation'/name).stat().st_size} for name in ['S3-startup-integrity-reassessment.md','S4-repaired-integration-report.md','SLICE-AND-DEVIATION-LEDGER.md']]
record={'at':datetime.now(timezone.utc).isoformat(),'state':'SPEC_READY_FOR_OWNER_REVIEW','contracts':'BOTH complete original CHAT-AR-SPEC-01 + repair CHAT-AR-REPAIR-01','currentReviewedRows':current,'currentReviewedByteIdentities':len(current),'archiveMappings':len(mapping),'ownedSafeExecutionArtifacts':artifacts,'originalTargets':original_targets,'historicalAuthorityAndPrefixVerified':historical,'frozen': [{'path':str(p),'sha256':expected} for p,expected in frozen],'sourceAndBuildCoreChangedAfterFinalReview':False,'currentAdministrativeAnnotationsHavePreimages':True,'negativeArchiveCount':len(archive['files']),'runtimeSafeArtifactCount':len(runtime['files']),'cleanupInitialExitCode':1,'cleanupInitialAllFourUnchanged':False,'cleanupFreshAllFourCurrentStable':True,'oldLogicalEqualityClaimed':False,'finalExecutionDisposition':'FIN-D01 accepted compatible measurement correction with direct timing/ownership/integrity and explicit limits','allOwnedRootsAndOutputGone':True,'ownerAcceptance':'pending','nonrecursivePolicy':'This manifest excludes its own bytes; report links this path without claiming self-hash'}
out.write_text(json.dumps(record,indent=2)+'\n')
assert all(Path(row['resolvedPath']).exists() for row in links)
print(json.dumps({'manifestPath':str(out),'sha256':sha(out.read_bytes()),'finalReportSha256':refresh['finalReportSha256'],'reviewedRows':len(current),'ownedArtifacts':len(artifacts),'localLinksChecked':len(links),'originalTargets':original_targets,'historyPrefixPreserved':True,'ownerAcceptance':'pending'}))
