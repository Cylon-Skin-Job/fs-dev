// Documentation-only S00 input inventory. Never imports application modules.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cp = require('child_process');
const matter = require('../../../../fusion-studio-client/node_modules/gray-matter');
const C = 'ai/RC-MacAir-15/Captures/034-Provenance_Wiki_Reconciliation';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const read = p => fs.readFileSync(p, 'utf8');
const run = (command, args) => {
  const result = cp.spawnSync(command, args, { encoding: 'utf8' });
  return { command: [command, ...args], at: new Date().toISOString(), exit: result.status, stdout: result.stdout, stderr: result.stderr };
};
const git = args => run('git', args);
const map = JSON.parse(read(`${C}/PAGE-MAP.json`));
const preparation = JSON.parse(read(`${C}/BASELINE.json`));
const candidate = JSON.parse(read(`${C}/CANDIDATE.json`));
const normative = candidate.artifacts.map(a => ({ ...a, actual: hash(fs.readFileSync(`${C}/${a.path}`)) }));
if (normative.some(a => a.sha256 !== a.actual)) throw Error('Candidate mismatch');
const aggregate = hash(normative.map(a => `${a.path}\t${a.actual}\n`).join(''));
if (aggregate !== candidate.aggregate_sha256) throw Error('Aggregate mismatch');
const commands = [git(['rev-parse','--show-toplevel']),git(['rev-parse','HEAD']),git(['status','--short']),git(['branch','-avv']),git(['worktree','list']),git(['for-each-ref','--format=%(refname) %(objectname)','refs/heads','refs/remotes'])];
const refs = commands[5].stdout.trim().split('\n').map(s => { const [ref,commit] = s.split(' '); return { ref, commit }; });
const refDrift = refs.filter(r => !preparation.refs.some(p => p.ref === r.ref && p.commit === r.commit));
const pages = [], claims = [], sourcePointers = [], links = [], vocabulary = [];
const sweep = /Captures\/|SPEC-|ULV-D|LED-D|TOOL-D|AUT-D|UEB-D|RSC-D|CHAT-D|AUD-D|acceptedRef|PreparedCanonicalCandidate|uiActionSeed|ledger_events|file\.version|resource:invalidate|fully built|stub/;
function anchors(text) {
  const used = new Map(); const result = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*$/); if (!m) continue;
    const slug = m[1].toLowerCase().replace(/<[^>]+>/g,'').replace(/[^\p{L}\p{N}_\-\s]/gu,'').replace(/ /g,'-');
    const count = used.get(slug)||0; used.set(slug,count+1); result.push(slug+(count?`-${count}`:''));
  }
  for (const m of text.matchAll(/(?:id|name)=["']([^"']+)["']/g)) result.push(m[1]);
  return result;
}
for (const row of map.pages) {
  const bytes = fs.readFileSync(row.path), text = bytes.toString('utf8'), parsed = matter(text);
  if (!text.startsWith('---\n') || typeof parsed.data.name !== 'string' || typeof parsed.data.description !== 'string' || !parsed.data.metadata) throw Error(row.path);
  for (const key of ['incoming-edges','outgoing-edges','source-files','connected-skills','related-trigger-files']) if (!Array.isArray(parsed.data.metadata[key])) throw Error(`${row.path}: ${key}`);
  const blocks = [...text.matchAll(/<!-- section-toc:start -->[\s\S]*?<!-- section-toc:end -->/g)].map(m=>m[0]);
  pages.push({ ...row, name: parsed.data.name, sha256: hash(bytes), bytes: bytes.length, text, generated_blocks: blocks, preparation_unchanged: preparation.wiki_pages.find(p=>p.path===row.path)?.sha256===hash(bytes) });
  for (const source of parsed.data.metadata['source-files']) sourcePointers.push({page:row.path,slice:row.slice,source,status:!fs.existsSync(source)?'missing':fs.statSync(source).isFile()?'file':'directory', disposition: row.scope==='primary'?'owning slice must validate exact symbol or replace/remove':'bounded supporting edit only; unrelated pointers remain named limitations'});
  const lines = text.split('\n'); let fence = false, generated = false, heading = 'frontmatter', frontmatter = true, current=[];
  const flush = () => { if(current.length){claims.push({id:`C${String(claims.length+1).padStart(4,'0')}`,page:row.path,slice:row.slice,heading,start_line:current[0].line,end_line:current.at(-1).line,text:current.map(x=>x.text).join('\n'),disposition:'input claim block; reconcile through topic allocation in EVIDENCE.md; not accepted current behavior'});current=[];} };
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(i===0) continue;
    if(frontmatter){if(line==='---') frontmatter=false;continue;}
    if(line.includes('<!-- section-toc:start -->')){flush();generated=true;}
    if(sweep.test(line)) vocabulary.push({page:row.path,line:i+1,text:line,slice:row.slice,disposition:generated?'generated: preserve bytes; explain outside block':row.scope==='primary'?'reconcile current/target/proposal with topic authority; remove ephemeral dependency':'inspect bounded provenance scope; unchanged unrelated exception only if recorded'});
    if(line.includes('<!-- section-toc:end -->')){generated=false;continue;}
    if(generated) continue;
    if(/^#{1,6}\s/.test(line)){flush();heading=line.replace(/^#+\s/,'');continue;}
    if(!line.trim()&&!fence){flush();continue;}
    if(/^\s*```/.test(line)) fence=!fence;
    current.push({line:i+1,text:line});
  }
  flush();
  // Inventory inline, reference-definition, and HTML href links, excluding code fences.
  let prose=text.replace(/```[\s\S]*?```/g,m=>'\n'.repeat(m.split('\n').length-1));
  const found = [...prose.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+["'][^)]*)?\)|^\s*\[[^\]]+\]:\s*(\S+)|href=["']([^"']+)["']/gm)];
  for(const m of found){let target=m[1]||m[2]||m[3]; target=target.replace(/^<|>$/g,''); const line=prose.slice(0,m.index).split('\n').length; let status='';
    if(/^[a-z][a-z0-9+.-]*:/i.test(target)){try{new URL(target);status='external-syntax-only';}catch{status='invalid-url';}}
    else {const [file,fragment] = target.split('#');const resolved=path.normalize(path.join(path.dirname(row.path),decodeURIComponent(file||path.basename(row.path))));status=!fs.existsSync(resolved)?'missing-target':fragment&&!anchors(read(resolved)).includes(decodeURIComponent(fragment))?'missing-fragment':'resolved';}
    links.push({page:row.path,line,target,status,slice:row.slice});
  }
}
const sourceRoots=['fusion-studio-server/lib/event-registry','fusion-studio-server/lib/subscriptions','fusion-studio-server/lib/file-mutations','fusion-studio-server/lib/agent-provenance','fusion-studio-server/lib/ledger','fusion-studio-server/lib/calendar'];
const sourceFiles=run('rg',['--files',...sourceRoots]).stdout.trim().split('\n');
sourceFiles.push(...['fusion-studio-server/lib/db.js','fusion-studio-server/lib/startup.js','fusion-studio-server/server.js','fusion-studio-server/lib/event-bus.js','fusion-studio-server/lib/http/calendar-routes.js','fusion-studio-server/lib/ws/file-save-route.js','fusion-studio-server/lib/ws/resource-provenance-route.js','fusion-studio-server/lib/ws/agent-activity-route.js','fusion-studio-server/lib/ws/resource-projection-publisher.js','fusion-studio-server/lib/ws/client-message-router.js','fusion-studio-server/lib/harness/opencode/json-event-translator.js','fusion-studio-server/lib/wire/canonical-harness-event-bridge.js','fusion-studio-client/src/lib/save-action-context.ts','fusion-studio-client/src/lib/ws/resource-provenance-protocol.ts','fusion-studio-client/src/lib/ws/resource-projection-protocol.ts','fusion-studio-client/src/lib/ws/file-handlers.ts','fusion-studio-client/src/state/fileDataStore.ts','fusion-studio-client/src/state/file-data-read-model.ts','fusion-studio-client/src/state/calendarStore.ts']);
const tests=run('rg',['--files','fusion-studio-server/test','fusion-studio-client/e2e']).stdout.trim().split('\n').filter(p=>/agent-provenance|resource-provenance|file-save|resource-projection|subscriptions|event-registry|file-provenance|bridge|provenance/.test(p));
const hashes=[...new Set([...sourceFiles,...tests,...sourcePointers.filter(x=>x.status==='file').map(x=>x.source)])].sort().map(p=>({path:p,sha256:hash(fs.readFileSync(p)),evidence:'inventory identity only; inspection anchors and test assertions are recorded separately in EVIDENCE.md'}));
const sourceDiff=git(['diff','--name-only','HEAD','--',...sourceRoots,...sourceFiles]);commands.push(sourceDiff);
const baseline={captured_at:new Date().toISOString(),candidate_id:candidate.candidate_id,aggregate_sha256:aggregate,root:commands[0].stdout.trim(),head:commands[1].stdout.trim(),commands,refs,ref_drift_since_preparation:refDrift,source_diff_from_head:sourceDiff.stdout.trim(),fetch:'not needed: refs/HEAD unchanged and bounded source surface unchanged; preparation fetched origin/gitlab; no claim about undisclosed remote changes',pages,source_test_hashes:hashes};
fs.writeFileSync(`${C}/EXECUTION-BASELINE.json`,JSON.stringify(baseline,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(`${C}/S00-INPUT-INVENTORY.json`,JSON.stringify({captured_at:baseline.captured_at,claims,sourcePointers,links,vocabulary,limitations:['Link checker is a bounded Markdown scanner, not a full CommonMark renderer; raw review checks fences/examples/reference use.','Census preserves complete paragraph/list/table/code blocks; topic matrix supplies authority and repair allocation.']},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({candidate:candidate.candidate_id,aggregate,parsed:pages.length,primary:pages.filter(p=>p.scope==='primary').length,unchanged:pages.filter(p=>p.preparation_unchanged).length,claims:claims.length,sourcePointers:sourcePointers.length,sourceDefects:sourcePointers.filter(x=>x.status!=='file'),links:links.length,linkDefects:links.filter(x=>!['resolved','external-syntax-only'].includes(x.status)),vocabulary:vocabulary.length,refDrift,sourceDiff:sourceDiff.stdout,sourceTestHashes:hashes.length},null,2));
