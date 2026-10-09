import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const evidence=path.resolve(import.meta.dirname,'../../../ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/spec-06/06B');
const log=path.join(evidence,`human-launch-${Date.now()}.log`);
const fd=fs.openSync(log,'wx',0o600);
const child=spawn(process.execPath,[path.join(import.meta.dirname,'human-session.mjs')],{cwd:path.resolve(import.meta.dirname,'../../..'),env:process.env,detached:true,stdio:['ignore',fd,fd]});
child.once('error',error=>{console.error('HUMAN_LAUNCH_FAILED '+error.code);process.exitCode=1;});
child.once('spawn',()=>{const receipt={driverPid:child.pid,stdout:log,detached:true,automaticExpiry:false,at:Date.now()};fs.writeFileSync(log+'.json',JSON.stringify(receipt,null,2));console.log('HUMAN_DRIVER_STARTED '+JSON.stringify(receipt));child.unref();fs.closeSync(fd);});
