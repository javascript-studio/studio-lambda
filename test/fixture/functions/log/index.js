'use strict';

const logger = require('@studio/log').out(process.stdout);

const log = logger('Test');

exports.handle = function (event, context, callback) {
  log.ok('Check');
  log.warn({ event });
  log.error({ event }, new Error());
  log.wtf();
  console.log('Raw log line');
  callback();
};
