'use strict';

exports.handle = function (event) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`Hello ${event.name}`);
    }, 1);
  });
};
