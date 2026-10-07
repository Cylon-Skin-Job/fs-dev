// Read-only S00 verification. No application imports or runtime operations.
const fs = require('fs');
const crypto = require('crypto');
const cp = require('child_process');
const matter = require('../../../../fusion-studio-client/node_modules/gray-matter');
const C = 'ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation';
const read = p => fs.readFileSync(p, 'utf8');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const assert = (condition, message) => { if (!condition) throw Error(message); };
const b = JSON.parse(read(`${C}/EXECUTION-BASELINE.json`));
const i = JSON.parse(read(`${C}/S00-INPUT-INVENTORY.json`));
const m = JSON.parse(read(`${C}/PAGE-MAP.json`));
const candidate = JSON.parse(read(`${C}/CANDIDATE.json`));
for (const a of candidate.artifacts) assert(sha(`${C}/${a.path}`) === a.sha256, `normative drift ${a.path}`);
assert(b.pages.length===27 && m.pages.length===27, 'page census');
assert(new Set(b.pages.map(p=>p.path)).size===27, 'duplicate page');
for (const row of b.pages) {
  assert(m.pages.some(p=>p.path===row.path && p.slice===row.slice),'allocation drift');
  assert(sha(row.path)===row.sha256, `wiki changed during S00: ${row.path}`);
  const text=read(row.path), {data}=matter(text);
  assert(typeof data.name==='string' && typeof data.description==='string' && data.metadata, `frontmatter ${row.path}`);
  for (const key of ['incoming-edges','outgoing-edges','source-files','connected-skills','related-trigger-files']) assert(Array.isArray(data.metadata[key]), `frontmatter key ${row.path}`);
  assert(JSON.stringify([...text.matchAll(/<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->/g)].map(x=>x[0]))===JSON.stringify(row.generated_blocks),'generated drift');
  assert(i.claims.some(c=>c.page===row.path && c.topics.length),`unallocated page ${row.path}`);
}
for(const file of ['AUTHORITY-MATRIX.md','EVIDENCE.md','CROSS-SECTION-DEPENDENCIES.md','S00-HANDOFF.md']){
  const {data}=matter(read(`${C}/${file}`));
  assert(typeof data.name==='string' && typeof data.description==='string' && data.metadata,`artifact frontmatter ${file}`);
}
assert(i.claims.length===438 && i.claims.every(c=>c.topics.length && c.disposition.includes(c.slice)), 'claim allocation');
const sourceDrift=b.source_test_hashes.filter(x=>sha(x.path)!==x.sha256);
assert(sourceDrift.length===0,`inspected source/test drift: ${sourceDrift.map(x=>x.path).join(',')}`);
const diff=cp.spawnSync('git',['diff','--check','--','ai/RC-MacAir-15/Wiki/010-Events_And_Ledger','ai/RC-MacAir-15/Wiki/002-Server_And_Runtime/PAGE.md','ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/005-Universal_Event_Bus/PAGE.md','ai/RC-MacAir-15/Wiki/005-Enforcement/001-Code_Standards/007-Persistence_And_Metadata/PAGE.md',C],{encoding:'utf8'});
assert(diff.status===0, diff.stdout+diff.stderr);
// Ordinary git diff omits untracked capture files: inspect these explicitly.
const owned=['s00-inventory.cjs','s00-verify.cjs','EXECUTION-BASELINE.json','S00-INPUT-INVENTORY.json','AUTHORITY-MATRIX.md','EVIDENCE.md','CROSS-SECTION-DEPENDENCIES.md','S00-HANDOFF.md'];
for(const file of owned) assert(!read(`${C}/${file}`).split('\n').some(line=>/[\t ]+$/.test(line)),`trailing whitespace ${file}`);
console.log(JSON.stringify({at:new Date().toISOString(),candidate:candidate.candidate_id,status:'S00_DOCUMENT_CHECKS_PASS',normative:9,pages:27,primary:24,supporting:3,claims:438,sourceTestHashes:b.source_test_hashes.length,sourceTestDrift:0,sourcePointerDefects:i.sourcePointers.filter(x=>x.status!=='file').length,links:i.links.length,linkDefects:i.links.filter(x=>!['resolved','external-syntax-only'].includes(x.status)).length,vocabularyMatches:i.vocabulary.length,wikiWrites:0,generatedBlocksUnchanged:true,productRuntimeChecks:'not run; excluded by SPEC'},null,2));
