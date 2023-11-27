"use strict";

/**************************************************************************
 * IMPORTS
 ***************************************************************************/

var fs                = require("fs");
var EmailBounceParser = require("../lib/index.js");

/**************************************************************************
 * CONFIGURATION
 ***************************************************************************/

const parser = new EmailBounceParser();

/**************************************************************************
 * TESTS
 ***************************************************************************/

function loopTests(entries, testFn) {
  entries.forEach((entry) => {
    var result = parseEmail(entry);
    var expected = readExpected(entry);

    if (typeof testFn === "function") {
      testFn(result, expected, entry);
    }
  });
}

function parseEmail(emailFile) {
  var email = fs.readFileSync(`${__dirname}/fixtures/${emailFile}.txt`, "utf-8");

  return parser.read(email);
}

function readExpected(emailFile) {
  var expected = fs.readFileSync(`${__dirname}/fixtures/expected/${emailFile}.json`, "utf-8");

  return JSON.parse(expected);
}

function testEmail(test, result, expected, entry) {
  var email = result.email || {};

  test.strictEqual(result.email.body, expected.email.body);
  test.strictEqual(result.email.intro, expected.email.intro);
  test.strictEqual(result.email.error, expected.email.error);

  test.strictEqual(result.data.error.code.basic, expected.data.error.code.basic);
  test.strictEqual(result.data.error.code.enhanced, expected.data.error.code.enhanced);
  test.strictEqual(result.data.error.label, expected.data.error.label);
  test.strictEqual(result.data.error.type, expected.data.error.type);

  test.strictEqual(result.data.server.hostname, expected.data.server.hostname);
  test.strictEqual(result.data.server.ip, expected.data.server.ip);
  test.strictEqual(result.data.server.port, expected.data.server.port);

  test.strictEqual(result.data.command.command, expected.data.command.command);
  test.strictEqual(result.data.command.end, expected.data.command.end);
}

module.exports = {
  // Test: common
  testCommon: function(test) {
    loopTests(
      [
        "550_permanent_failure",
        "554_message_rejected",
        "554_5_7_1_rejected_spam",
      ],

      (result, expected, entry) => {
        testEmail(
          test,
          result,
          expected,
          entry
        );
      }
    );

    test.done();
  }
}
