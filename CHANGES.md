# Changes

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
