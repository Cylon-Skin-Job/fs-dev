'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { ThreadManager } = require('../../lib/thread/ThreadManager');

describe('ThreadManager chatlog markdown path', () => {
  let tempRoot;
  let previousMachine;

  beforeEach(() => {
    previousMachine = process.env.FUSION_LOCAL_MACHINE;
    process.env.FUSION_LOCAL_MACHINE = 'RC MacAir 15';
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fusion-chatlog-path-'));
  });

  afterEach(() => {
    if (previousMachine === undefined) {
      delete process.env.FUSION_LOCAL_MACHINE;
    } else {
      process.env.FUSION_LOCAL_MACHINE = previousMachine;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('writes future markdown mirrors under machine-scoped Data/Chatlogs without a user folder', async () => {
    const manager = new ThreadManager({
      projectRoot: tempRoot,
      workspaceId: 'workspace-chatlog-path',
    });
    const chatFile = manager._createChatFile('thread-1');

    expect(chatFile.filePath).toBe(path.join(
      tempRoot,
      'ai',
      'RC-MacAir-15',
      'Data',
      'Chatlogs',
      'threads',
      'thread-1.md'
    ));

    await chatFile.write('Thread One', [
      { role: 'user', content: 'hello' },
    ]);

    expect(fs.existsSync(chatFile.filePath)).toBe(true);
    expect(fs.readdirSync(path.dirname(chatFile.filePath))).toEqual(['thread-1.md']);
  });

  test('returns null when the machine-scoped markdown mirror is absent', async () => {
    const manager = new ThreadManager({
      projectRoot: tempRoot,
      workspaceId: 'workspace-chatlog-path',
    });
    const chatFile = manager._createChatFile('missing-thread');

    await expect(chatFile.read()).resolves.toBeNull();
    expect(fs.existsSync(chatFile.filePath)).toBe(false);
  });
});
