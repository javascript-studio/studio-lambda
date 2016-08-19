# Studio Lambda

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
- `lambda_ctrl.invoke(lambda_name, event, callback)`: Invokes the named lambda
  `handle` function, passing `(event, {}, callback)`.

[apex]: http://apex.run
