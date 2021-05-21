'use strict';

exports.handle = function (event, context, callback) {
  setTimeout(() => {
    const obj = {
      toJSON() {
        throw new Error('Ouch!');
      }
    };
    callback(null, obj);
  }, 1);
};
