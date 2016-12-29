'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    callback(null, () => {});
  }, 1);
};
