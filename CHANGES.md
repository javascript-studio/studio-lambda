# Changes

## 1.7.0

- Do not log lambda input and output

    The new `@studio/wrap` implementation already do logging within the
    Lambda function. Log filtering should also be applied there.

## 1.6.2

- 🐛  Pass on parent process `execArgv`

    This allows to invoke the parent process with v8 options like
    `--stack-trace-limit=50` and have them passed on to the Lambda
    processes. This restores the default behavior for child processes.

## 1.6.1

Log output improvements:

- 🔢  Include the Lambda execution time in the stats log message
- 🙈  Set `config_file` to `"<defaults>"` if not found
- 🙈  Remove messages to streamline log output

## 1.6.0

- 🔢  Log Lambda process memory usage

## 1.5.0

- 🍏  Add Lamdba debugging option

## 1.4.0

- 🍏  Pass on `process.env.DEBUG`

## 1.3.3

- 🍏  Improve log output filtering
- 🍏  Handle Lambda logs on stdout
- 🙈  Do not log `authorizationToken`
- 🐛  Fix log message with string event

## 1.3.2

- 🐛  Reduce duplication in log messages

## 1.3.1

- 🐛  Rename logger

## 1.3.0

- 🍏  Use `@studio/log`

## 1.2.2

- 🐛  Handle invalid lambda response

## 1.2.1

- 🐛  Timeouts are defined in seconds

## 1.2.0

- 🍏  Add `base_dir` config option

## 1.1.2

- 🍏  Pass `HOME` environment variable for the `aws-sdk` module to find the
  credentials file
- ✨  Change log emoji for send and receive events

## 1.1.1

A few bug fixes and minor improvements:

- 🐛  Preserve configured env if config file is loaded
- 🐛  Do not log authorization and token header values
- 🐛  Prefix log messages with "Lambda"
- 🐛  Log lambda error response

## 1.1.0

- 🍏  Allow to pass an optional `context` object to the Lambda handler
  function. If no context is given, it defaults to an empty object, retaining
  the previous behavior.

## 1.0.0

- ✨ Inception
