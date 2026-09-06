'use strict';

const { createDurableReservationAuthority } = require('./durable-reservations');
const { createFileOperationRepository } = require('./file-operation-repository');
const { createFileSaveController } = require('./save-controller');
const { createFileSaveReconciler } = require('./reconciliation');
const { assertPublishers } = require('./fact-replay');

function createFileSaveOwner({
  db,
  publishResourceRefreshRequired,
  controllerOptions = {},
  reconcilerOptions = {},
}) {
  if (typeof db !== 'function') throw new TypeError('Knex database is required');
  if (typeof publishResourceRefreshRequired !== 'function') {
    throw new TypeError('controller resource recovery publisher is required');
  }
  const operations = createFileOperationRepository(db);
  const reservations = createDurableReservationAuthority(db);
  let installed = false;
  let controller = null;
  let reconciler = null;

  function installPublishers(publishers) {
    if (installed) throw new Error('File-save publishers are already installed');
    assertPublishers(publishers);
    installed = true;
    controller = createFileSaveController({
      ...controllerOptions,
      operations,
      reservations,
      publishers,
      publishResourceRefreshRequired,
    });
    reconciler = createFileSaveReconciler({
      ...reconcilerOptions,
      operations,
      reservations,
      publishers,
      publishResourceRefreshRequired,
    });
  }

  return Object.freeze({
    installPublishers,
    verifyReservation: reservations.verify,
    async save(input) {
      if (!controller) throw new Error('File-save publishers are not installed');
      return controller.save(input);
    },
    async reconcile() {
      if (!reconciler) throw new Error('File-save publishers are not installed');
      return reconciler.reconcile();
    },
  });
}

module.exports = { createFileSaveOwner };
