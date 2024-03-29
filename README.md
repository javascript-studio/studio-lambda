# Studio Lambda

🚀 A custom [AWS Lambda][1] execution environment for local testing. Runs
each Lambda function in it's own process. Integrates with [Studio Gateway][2].

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
  - `memory`: The default Lambda memory to use in MB. Defaults to 128 MB. This
    will set `--max-old-space-size` on Lambda processes.
  - `max_idle`: The idle timeout to use in milliseconds. If a function is
    not invoked for this time, the process gets destroyed. Defaults to 1 hour.
- `lambda.invoke(lambda_name, event[, options][, callback])`: Invokes the named
  Lambda `handle` function. If no callback is given, a promise is returned.
  These options are supported:
  - `awsRequestId`: The AWS request ID to use in the Lambda `context`.
    If a context is given, but one of the above properties is missing, they are
    added to the context.
- `lambda.shutdown([options])`: Shut down all processes. These options may be
  given:
  - `graceful`: Wait for running instances before closing processes. If this
    is not set to `true`, all processes are killed immediately.
- `lambda.stats()`: Returns stats for this lambda instance. Returns an object
  where the keys are the Lambda function names and each value is an object with
  these properties:
  - `instances`: The total number of instances running.
  - `active`: The number of instances currently handling requests.
  - `requests`: The total number of requests received.

## Lambda context

Lambda function are invoked with `(event, context[, callback])` where the
`context` has this interface:

- `functionName`: The name of the Lambda function.
- `invokedFunctionArn`: The function ARN, build from the `AWS_REGION`
  (defaulting to `us-east-1`), `STUDIO_AWS_ACCOUNT` (defaulting to
  `000000000000`) and the Lambda function name.
- `memoryLimitInMB`: The configured memory limit.
- `awsRequestId`: The AWS request ID, either from `options` or generated.
- `getRemainingTimeInMillis()`: Returns the remaining time until the Lambda
  function times out.

If `callback` is not defined (the lambda handler function has an arity < 3), the function is expected to return a promise.

## Debugging Lambda functions

If the environment variable `STUDIO_LAMBDA_INSPECT` is set to the name of a
Lambda function, the node process for that function will be called with
`--inspect` and the timeout value is ignored. This prints a Chrome debugger URL
to the console. With this setup in place, you can add `debugger` statements to
place breakpoints.

[1]: https://aws.amazon.com/lambda/
[2]: https://github.com/javascript-studio/studio-gateway
