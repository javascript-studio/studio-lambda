'use strict';

const logger = require('@studio/log');
const Stringify = require('@studio/ndjson/stringify');

logger.pipe(new Stringify()).pipe(process.stdout);

const log = logger('Test');

exports.handle = function (event, context, callback) {
  log.ok('Check');
  log.warn({ event });
  log.error({ event }, new Error());
  log.wtf();
  console.log('Raw log line');
  callback();
};
