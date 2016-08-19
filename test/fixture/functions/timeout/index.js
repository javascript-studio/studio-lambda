'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback('E_TOO_LATE');
  }, 200);
};
