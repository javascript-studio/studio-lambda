# Changes

## 1.13.0

- 🍏 Add `shutdown` and `stats` APIs
- 🐛 Improve lambda function error handling
- 🐛 Handle ndjson transform errors

## 1.12.0

- 🍏 Use configured memory and improve process exit handling

## 1.11.1

- 🐛 Improve generated `awsRequestId`

## 1.11.0

- 🍏 Add support for `functionName`.
- 🍏 Add support for `awsRequestId`.
- 🍏 Add support for `memoryLimitInMB`.
- 🍏 Add support for `getRemainingTimeInMillis()`.
- 🐛 Build the function ARN within the Lambda function instead of injecting it.
  The `STUDIO_AWS_ACCOUNT` environment variable was not picket up correctly.

## 1.10.1

- ✨ Use `@studio/ndjson` to parse log output from Lambdas

## 1.10.0

- ⚠️ Remove hack to filter log data

    > Log data should be filtered where it's created. With the new
    > `@studio/log-x` module and the updated `@studio/wrap` this hack can be
    > removed.

- ✨ Add `package-lock.json`

## 1.9.1

- 🐛 Add `invokedFunctionArn` to given context if missing

## 1.9.0

- 🍏 Generate `invokedFunctionArn` in default context
- 📚 Use upper case `Lambda` module name in examples

## 1.8.2

- 🐛 Fix entries cleanup in kill handler

    > The entries array is not necessarily cleaned up in reverse insertion
    > order. With this patch, the kill handler does not expect the entry at a
    > fixed position, but queries the entry to remove by ID instead.


## 1.8.1

- 🐛 Fail on missing environment variables

    > - Throw an error if a variable replacement fails.
    > - Handle launch exceptions by logging an error and invoking the callback
    >   with an error message.

## 1.8.0

- 🍏 Support environment variable replacement in Lambda config files

    > If a config file contains placeholders in the form `${ENV_VAR}`, they are
    > replaced with the corresponding environment variable. This feature is not
    > supported by Apex. Use it to configure secret variables in local configs.

## 1.7.0

- 🙊 Do not log Lambda input and output

    > The new `@studio/wrap` implementation already do logging within the
    > Lambda function. Log filtering should also be applied there.

## 1.6.2

- 🐛 Pass on parent process `execArgv`

    > This allows to invoke the parent process with v8 options like
    > `--stack-trace-limit=50` and have them passed on to the Lambda
    > processes. This restores the default behavior for child processes.

## 1.6.1

Log output improvements:

- 🔢 Include the Lambda execution time in the stats log message
- 🙈 Set `config_file` to `"<defaults>"` if not found
- 🙈 Remove messages to streamline log output

## 1.6.0

- 🔢 Log Lambda process memory usage

## 1.5.0

- 🍏 Add Lamdba debugging option

## 1.4.0

- 🍏 Pass on `process.env.DEBUG`

## 1.3.3

- 🍏 Improve log output filtering
- 🍏 Handle Lambda logs on stdout
- 🙈 Do not log `authorizationToken`
- 🐛 Fix log message with string event

## 1.3.2

- 🐛 Reduce duplication in log messages

## 1.3.1

- 🐛 Rename logger

## 1.3.0

- 🍏 Use `@studio/log`

## 1.2.2

- 🐛 Handle invalid lambda response

## 1.2.1

- 🐛 Timeouts are defined in seconds

## 1.2.0

- 🍏 Add `base_dir` config option

## 1.1.2

- 🍏 Pass `HOME` environment variable for the `aws-sdk` module to find the
  credentials file
- ✨ Change log emoji for send and receive events

## 1.1.1

A few bug fixes and minor improvements:

- 🐛 Preserve configured env if config file is loaded
- 🐛 Do not log authorization and token header values
- 🐛 Prefix log messages with "Lambda"
- 🐛 Log lambda error response

## 1.1.0

- 🍏 Allow to pass an optional `context` object to the Lambda handler
  function. If no context is given, it defaults to an empty object, retaining
  the previous behavior.

## 1.0.0

- ✨ Inception
