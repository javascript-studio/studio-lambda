'use strict';

let count = 0;

exports.handle = function (event, context, callback) {
  count++;
  setTimeout(() => {
    callback(null, `Count ${count}`);
  }, 200);
};
