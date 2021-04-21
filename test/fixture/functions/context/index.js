'use strict';

exports.handle = function (event, context, callback) {
  const ctx = Object.assign(
    {
      invokedFunctionArn: context.invokedFunctionArn // getter
    },
    context
  );
  setTimeout(() => {
    callback(null, JSON.stringify(ctx));
  }, 1);
};
