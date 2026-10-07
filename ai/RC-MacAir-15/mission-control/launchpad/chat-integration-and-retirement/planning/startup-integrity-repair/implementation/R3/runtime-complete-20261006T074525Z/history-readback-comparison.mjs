import crypto from 'node:crypto';
export const normalizeVisibleText=value=>String(value).replace(/\s+/g,' ').trim();
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const summary=value=>({chars:String(value).length,sha256:hash(value),normalizedSha256:hash(normalizeVisibleText(value))});
export function compareOwnedHistory({rows,threadId,visibleUsers,visibleAssistants}){
 const owned=rows.filter(e=>e.thread_id===threadId).sort((a,b)=>a.seq-b.seq),completed=visibleAssistants.filter(a=>a.completed);
 const identityValid=owned.length>0&&new Set(owned.map(e=>e.id)).size===owned.length&&new Set(owned.map(e=>e.seq)).size===owned.length;
 const comparisons=owned.map((e,index)=>{
  const data=JSON.parse(e.assistant);const textParts=data.parts.filter(p=>p.type==='text');
  const supported=textParts.length>0&&textParts.every(p=>typeof p.content==='string');
  const stored=supported?textParts.map(p=>p.content).join(''):'';
  const visible=completed[index]?.texts.filter(t=>!t.streaming).map(t=>t.text).join('')??'';
  const user=visibleUsers[index]??'';
  return {exchangeId:e.id,seq:e.seq,turnId:e.turn_id,visibleRowIndex:index,supportedTextParts:supported,
   userBytesExact:user===e.user_input,assistantNormalizedExact:supported&&normalizeVisibleText(stored).length>0&&normalizeVisibleText(stored)===normalizeVisibleText(visible),
   assistantRawBytesExact:stored===visible,normalization:'collapse whitespace and trim; raw/normalized hashes retained',
   storedUser:summary(e.user_input),visibleUser:summary(user),storedAssistant:summary(stored),visibleAssistant:summary(visible)};
 });
 const counts={durableSelected:owned.length,visibleUsers:visibleUsers.length,visibleCompletedAssistants:completed.length};
 return {exactComparisons:comparisons,historyRowCounts:counts,identityValid,
  exactSelectedHistory:identityValid&&owned.length===visibleUsers.length&&owned.length===completed.length&&comparisons.every(e=>e.userBytesExact&&e.assistantNormalizedExact)};
}
