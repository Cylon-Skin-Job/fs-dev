import fs from 'node:fs';
import path from 'node:path';

// Each batch is synchronously persisted. Rotation retains every segment.
export function createHumanJournal(directory,{segmentBytes=16*1024*1024}={}) {
  fs.mkdirSync(directory,{recursive:true});let fd=null,index=0,bytes=0,closed=false,pending=[],dropped=0;
  const open=()=>{fd=fs.openSync(path.join(directory,`events-${String(++index).padStart(4,'0')}.ndjson`),'wx',0o600);bytes=0;};open();
  const flush=()=>{if(!pending.length&&!dropped)return;const line=JSON.stringify({kind:'disk-batch',at:Date.now(),records:pending,dropped})+'\n';const size=Buffer.byteLength(line);if(bytes&&bytes+size>segmentBytes){fs.fdatasyncSync(fd);fs.closeSync(fd);open();}fs.writeSync(fd,line);bytes+=size;fs.fdatasyncSync(fd);pending=[];dropped=0;};
  return {
    write(record){if(closed)throw Error('journal closed');if(pending.length>=4096){pending.shift();dropped++;}pending.push(record);},
    flush,
    close(){if(closed)return;flush();closed=true;fs.fdatasyncSync(fd);fs.closeSync(fd);},
  };
}

export function assertHumanConfig(config) {
  const actual=config?.opencode?.runtime;
  if(actual?.model!=='togetherai/deepseek-ai/DeepSeek-V4.1-Flash'||actual?.variant!=='high'||actual?.thinking!==true)throw Error('Requested human-session model/high/thinking configuration not resolved');
  return {harness:'opencode',model:actual.model,variant:actual.variant,thinking:actual.thinking};
}

export function humanSmokeReply(exchange,receipt,terminal) {
  const assistant=JSON.parse(exchange.assistant),metadata=JSON.parse(exchange.metadata||'{}');
  const text=(assistant.parts||[]).filter(part=>part.type==='text').map(part=>String(part.content||'')).join('');
  if(receipt?.outcome!=='accepted'||terminal?.turnId!==receipt.turn_id||terminal?.terminalErrorCode||['error','interrupted'].includes(terminal?.reason)||metadata.partial===true||!text.includes('HUMAN_SESSION_READY'))throw Error('Real provider smoke did not save a successful text reply');
  return text;
}
