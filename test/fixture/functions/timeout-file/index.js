'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    // eslint-disable-next-line n/no-callback-literal
    callback('E_TOO_LATE');
  }, 200);
};
