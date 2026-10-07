export function projectOpenCodeChild(record, scratchWorkspace) {
  if (!/(?:^|[\/\s])opencode(?:[.\s\/]|$)/i.test(record.command)) return null;
  const runtimeRun = /(?:^|\s)run(?:\s|$)/.test(record.command);
  const jsonFormat = /(?:^|\s)--format(?:=|\s+)json(?:\s|$)/.test(record.command);
  const scratchDirectoryArgument = record.command.includes('--dir '+scratchWorkspace+' ')
    || record.command.includes('--dir='+scratchWorkspace+' ');
  const fixedPromptArgument = record.command.includes('Reply with exactly CHAT-AR-REPAIR-READY.');
  const versionProbe = /(?:^|\s)--version(?:\s|$)/.test(record.command);
  const sessionMatch = record.command.match(/(?:^|\s)--session(?:=|\s+)([A-Za-z0-9_-]{1,128})(?:\s|$)/);
  return {pid:record.pid,ppid:record.ppid,start:record.start,executable:record.command.split(' ')[0],
    role:versionProbe?'version-probe':runtimeRun&&jsonFormat?'runtime-run-json':'other-opencode',
    scratchDirectoryArgument,fixedPromptArgument,sessionArgument:sessionMatch?.[1]??null,
    runtimeCandidate:!versionProbe&&runtimeRun&&jsonFormat&&scratchDirectoryArgument&&fixedPromptArgument};
}
