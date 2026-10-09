/** Public runtime command facade; state lives only in ThreadRuntimeManager. */
module.exports = {
  ...require('./runtime-activation'),
  ...require('./runtime-prompt-admission'),
  ...require('./runtime-stop'),
  ...require('./runtime-identity'),
};
