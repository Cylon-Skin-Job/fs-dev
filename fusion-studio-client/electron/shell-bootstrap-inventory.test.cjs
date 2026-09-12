'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('server bootstrap uses only inherited fd 3 and never env, argv, or ordinary streams', () => {
  const source = fs.readFileSync(path.join(__dirname, 'server-spawn.cjs'), 'utf8');
  assert.match(source, /stdio: nativeObserverHealthOnly[\s\S]*\['ignore', 'pipe', 'pipe', 'pipe', 'pipe'\]/);
  assert.match(source, /child\.stdio\[3\]/);
  assert.match(source, /child\.stdio\[4\]/);
  assert.match(source, /bootstrapPipe\.end\(bootstrapPayload/);
  assert.match(source, /env\.FUSION_ELECTRON_SERVER = '1'/);
  assert.doesNotMatch(source, /env\.[A-Z_]*(?:AUTH|SECRET|MASTER|BOOTSTRAP|GENERATION)/);
  assert.doesNotMatch(source, /\[serverPath,\s*bootstrapPayload/);
  assert.doesNotMatch(source, /child\.stdin/);
});

test('main rotates launch authority before every server spawn and binds descriptor generation', () => {
  const source = fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8');
  assert.equal((source.match(/shellLaunchAuthority = createShellLaunchAuthority\(\)/g) || []).length, 2);
  assert.equal((source.match(/bootstrapAuthority: shellLaunchAuthority/g) || []).length, 2);
  assert.equal((source.match(/onWorkspaceBinding:/g) || []).length, 2);
  assert.equal((source.match(/runtimeDescriptorOwner\.activate\(port, shellLaunchAuthority\.generation\)/g) || []).length, 2);
});
