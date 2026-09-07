'use strict';

const SHELL_PROOF_SIGN_CHANNEL = 'fusion-shell-auth:sign';

function registerShellProofIpc({ authorizedIpcMain, getLaunchAuthority, log }) {
  authorizedIpcMain.handle(SHELL_PROOF_SIGN_CHANNEL, (_event, request) => {
    const authority = getLaunchAuthority();
    if (!authority || !request || typeof request !== 'object' || Array.isArray(request)) {
      log?.('shell_proof_denied');
      return null;
    }
    const keys = Reflect.ownKeys(request);
    if (keys.length !== 2 || !keys.includes('challenge') || !keys.includes('rendererNonce')) {
      log?.('shell_proof_denied');
      return null;
    }
    const result = authority.sign(request.challenge, request.rendererNonce);
    if (!result) log?.('shell_proof_denied');
    return result;
  });
}

module.exports = { SHELL_PROOF_SIGN_CHANNEL, registerShellProofIpc };
