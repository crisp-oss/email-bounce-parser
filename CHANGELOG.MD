Changelog
=========

## v2.0.0

- Drop re2: all regexes are now linear and ReDoS-safe on native `RegExp`.
- Remove the `re2` optional peer dependency and the `unit:regexp` test script.
- Add ReDoS regression tests, running hostile inputs against every regex.
- Update CI to Node 26.

## v1.1.1

- Version bump only.

## v1.1.0

- Add optional re2 support.
- Drop Node < 22.
- Publish with NPM OIDC tokens.

## v1.0.22

- Version bump only.

## v1.0.21

- Add more test cases.

## v1.0.20

- Improve enhanced type detection.

## v1.0.19

- Add reputation enhanced type.

## v1.0.18

- Add Outlook bounce example.

## v1.0.17

- Fix typing issues.
- Add more bounce variants.

## v1.0.16

- Clean up error label.
- Add more variants for spam and unknown server bounces.

## v1.0.15

- Add more variants for mailbox full bounces.

## v1.0.1 - v1.0.14

- Parse basic and enhanced error codes, and error type.
- Parse recipient, server and command.
- Detect permanent and temporary bounces.
- Split bounce intro and actual error text.
- Add many bounce variants (550 5.1.1, 550 5.2.1, etc.).
