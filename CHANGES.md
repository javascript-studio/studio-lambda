# Changes

## 1.3.1

- Rename logger

## 1.3.0

- Use `@studio/log`

## 1.2.2

- Handle invalid lambda response

## 1.2.1

- Timeouts are defined in seconds

## 1.2.0

- Add `base_dir` config option

## 1.1.2

- Pass `HOME` environment variable for the `aws-sdk` module to find the
  credentials file
- Change log emoji for send and receive events

## 1.1.1

A few bug fixes and minor improvements:

- Preserve configured env if config file is loaded
- Do not log authorization and token header values
- Prefix log messages with "Lambda"
- Log lambda error response

## 1.1.0

Allow to pass an optional `context` object to the Lambda handler function. If
no context is given, it defaults to an empty object, retaining the previous
behavior.

## 1.0.0

- Inception
