# JavaScript Studio Lambda

A custom lambda execution environment for local testing. Runs each lambda
function in it's own process. Defaults are tailored for [apex][].

## Usage

```js
const lambda = require('@studio/lambda');

const lambda_ctrl = lambda.create();
lambda_ctrl.invoke('some-lambda', { some: 'event' }, callback);
```

## API

- `lambda_ctrl = lambda.create([options])`: Returns a new lambda controller for
  the given options.
    - `base_dir`: The base directory to use. Defaults to the current working
      directory.
    - `lambda_path`: The path to the lambda function. Replaces `${LAMBDA_NAME}`
      with the lambda name. Defaults to `functions/${LAMBDA_NAME}/`.
    - `env`: An object with environment variables to use. Defaults to an empty
      object.
    - `config_file`: A JSON file with additional `environment` and `timeout`
      properties. Defaults to
      `functions/${LAMBDA_NAME}/function.${AWS_PROFILE}.json`.
    - `timeout`: The default lambda timeout to use in milliseconds. Defaults
      to 5 seconds.
    - `max_idle`: The idle timeout to use in milliseconds. If a function is
      not invoked for this time, the process gets destroyed. Defaults to 1 hour.
- `lambda_ctrl.invoke(lambda_name, event[, context], callback)`: Invokes the
  named lambda `handle` function, passing `(event, context, callback)`. If
  `context` is not given, it defaults to an empty object.

## Debugging Lambda functions

If the environment variable `STUDIO_LAMBDA_INSPECT` is set to the name of a
Lambda function, the node process for that function will be called with
`--inspect` and the timeout value is ignored. This prints a Chrome debugger URL
to the console. With this setup in place, you can add `debugger` statements to
place breakpoints.

[apex]: http://apex.run
