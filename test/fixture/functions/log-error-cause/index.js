'use strict';

const logger = require('@studio/log').out(process.stdout);

const log = logger('Test');

exports.handle = function (event, context, callback) {
  const err = new Error('Fail');
  err.cause = new Error('Cause');
  log.error('Failure', err);
  callback();
};
