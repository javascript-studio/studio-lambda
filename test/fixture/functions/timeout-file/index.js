'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    // eslint-disable-next-line node/no-callback-literal
    callback('E_TOO_LATE');
  }, 200);
};
