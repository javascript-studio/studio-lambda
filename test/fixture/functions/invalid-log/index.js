'use strict';

exports.handle = function (event, context, callback) {
  console.log('{"some":"incomplete json output');
  setTimeout(callback, 1);
};
