# Studio Lambda

A custom [AWS Lambda][1] execution environment for local testing. Runs
each Lambda function in it's own process. Integrates with [Studio Gateway][2].
Defaults are tailored for [apex][3].

## Usage

```js
const Lambda = require('@studio/lambda');

const lambda = Lambda.create();
lambda.invoke('some-lambda', { some: 'event' }, callback);
```

## API

- `lambda = Lambda.create([options])`: Returns a new Lambda controller for
  the given options.
    - `base_dir`: The base directory to use. Defaults to the current working
      directory.
    - `lambda_path`: The path to the Lambda function. Replaces `${LAMBDA_NAME}`
      with the Lambda name. Defaults to `functions/${LAMBDA_NAME}/`.
    - `env`: An object with environment variables to use. Defaults to an empty
      object.
    - `config_file`: A JSON file with additional `environment` and `timeout`
      properties. Defaults to
      `functions/${LAMBDA_NAME}/function.${AWS_PROFILE}.json`. Placeholders in
      the form of `${ENV_VAR}` are replaced with the corresponding environment
      variable.
    - `timeout`: The default Lambda timeout to use in milliseconds. Defaults
      to 5 seconds.
    - `max_idle`: The idle timeout to use in milliseconds. If a function is
      not invoked for this time, the process gets destroyed. Defaults to 1 hour.
- `lambda.invoke(lambda_name, event[, context], callback)`: Invokes the named
  Lambda `handle` function, passing `(event, context, callback)`. If `context`
  is not given, it defaults to an object with these properties:
    - `invokedFunctionArn`: The function ARN, build from the `AWS_REGION`
      (defaulting to `us-east-1`), `STUDIO_AWS_ACCOUNT` (defaulting to `0000`)
      and the Lambda function name.

## Debugging Lambda functions

If the environment variable `STUDIO_LAMBDA_INSPECT` is set to the name of a
Lambda function, the node process for that function will be called with
`--inspect` and the timeout value is ignored. This prints a Chrome debugger URL
to the console. With this setup in place, you can add `debugger` statements to
place breakpoints.

[1]: https://aws.amazon.com/lambda/
[2]: https://github.com/javascript-studio/studio-gateway
[3]: http://apex.run
