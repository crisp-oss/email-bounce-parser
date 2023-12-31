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
  test.strictEqual(result.bounce, expected.bounce);

  if (result.bounce === true) {
    test.strictEqual(result.email.body, expected.email.body);
    test.strictEqual(result.email.intro, expected.email.intro);
    test.strictEqual(result.email.error, expected.email.error);

    test.strictEqual(result.data.error.code.basic, expected.data.error.code.basic);
    test.strictEqual(result.data.error.code.enhanced, expected.data.error.code.enhanced);
    test.strictEqual(result.data.error.label, expected.data.error.label);
    test.strictEqual(result.data.error.type, expected.data.error.type);
    test.strictEqual(result.data.error.temporary, expected.data.error.temporary);
    test.strictEqual(result.data.error.permanent, expected.data.error.permanent);
    test.strictEqual(result.data.error.data.type, expected.data.error.data.type);
    test.strictEqual(result.data.error.data.blocked, expected.data.error.data.blocked);
    test.strictEqual(result.data.error.data.spam, expected.data.error.data.spam);

    test.strictEqual(result.data.recipient, expected.data.recipient);

    test.strictEqual(result.data.server.hostname, expected.data.server.hostname);
    test.strictEqual(result.data.server.ip, expected.data.server.ip);
    test.strictEqual(result.data.server.port, expected.data.server.port);

    test.strictEqual(result.data.command, expected.data.command);
  }
}

module.exports = {
  // Test: default
  testDefault: function(test) {
    loopTests(
      [
        "default",
        "empty"
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
  },

  // Test: common
  testCommon: function(test) {
    loopTests(
      [
        "unknown_server_connection",
        "unknown_server_connection_variant_1",

        "unknown_server_unknown",
        "unknown_server_unknown_variant_1",
        "unknown_server_unknown_variant_2",
        "unknown_server_unknown_variant_3",

        "unknown_server_timeout",
        "unknown_server_timeout_variant_2",

        "unknown_temporary",

        "421_too_many_connections",

        "421_4_4_2_timeout",

        "421_4_7_0_deferred",

        "421_4_7_28_ip_blocked_spam",

        "450_rate_limited",

        "450_4_2_1_no_such_recipient",

        "450_4_2_1_rate_limited",

        "451_action_aborted_local_error",

        "451_4_7_1_reputation",

        "451_4_7_500_server_busy",

        "451_4_7_650_reputation",

        "452_4_2_2_mailbox_full",

        "550_permanent_failure",
        "550_not_allowed",
        "550_mailbox_unavailable",
        "550_mailbox_full",
        "550_spam",
        "550_unkown_server",

        "550_no_such_recipient",
        "550_no_such_recipient_variant_1",
        "550_no_such_recipient_variant_2",
        "550_no_such_recipient_variant_3",
        "550_no_such_recipient_variant_4",
        "550_no_such_recipient_variant_5",
        "550_no_such_recipient_variant_6",
        "550_no_such_recipient_variant_7",
        "550_no_such_recipient_variant_8",
        "550_no_such_recipient_variant_9",
        "550_no_such_recipient_variant_10",
        "550_no_such_recipient_variant_11",

        "550_5_0_1_no_such_recipient",

        "550_5_1_0_address_rejected",

        "550_5_1_1_no_such_recipient",
        "550_5_1_1_no_such_recipient_variant_1",
        "550_5_1_1_no_such_recipient_variant_2",
        "550_5_1_1_no_such_recipient_variant_3",
        "550_5_1_1_no_such_recipient_variant_4",
        "550_5_1_1_no_such_recipient_variant_5",
        "550_5_1_1_no_such_recipient_variant_6",
        "550_5_1_1_no_such_recipient_variant_7",
        "550_5_1_1_no_such_recipient_variant_8",
        "550_5_1_1_no_such_recipient_variant_9",
        "550_5_1_1_no_such_recipient_variant_10",
        "550_5_1_1_no_such_recipient_variant_11",
        "550_5_1_1_no_such_recipient_variant_12",
        "550_5_1_1_no_such_recipient_variant_13",
        "550_5_1_1_no_such_recipient_variant_14",
        "550_5_1_1_no_such_recipient_variant_15",
        "550_5_1_1_no_such_recipient_variant_16",
        "550_5_1_1_no_such_recipient_variant_17",
        "550_5_1_1_no_such_recipient_variant_18",
        "550_5_1_1_no_such_recipient_variant_19",
        "550_5_1_1_no_such_recipient_variant_20",
        "550_5_1_1_no_such_recipient_variant_21",
        "550_5_1_1_no_such_recipient_variant_22",
        "550_5_1_1_no_such_recipient_variant_23",

        "550_5_1_10_no_such_recipient",
        "550_5_1_10_no_such_recipient_variant_1",

        "550_5_2_0_message_rejected",

        "550_5_2_1_recipient_unknown",
        "550_5_2_1_account_disabled",

        "550_5_4_1_no_such_recipient",
        "550_5_4_1_no_such_recipient_variant_1",
        "550_5_4_1_no_such_recipient_variant_2",
        "550_5_4_1_no_such_recipient_variant_3",

        "550_5_4_310_server_unknown",

        "550_5_5_0_no_such_recipient",

        "550_5_7_1_blocked",

        "550_5_7_1_reputation",
        "550_5_7_1_reputation_variant_1",

        "550_5_7_1_service_refused",

        "550_5_7_1_spam_content",
        "550_5_7_1_spam_content_variant_1",
        "550_5_7_1_spam_content_variant_2",
        "550_5_7_1_spam_content_variant_3",

        "550_5_7_26_authentication_failure",

        "550_5_7_129_restricted_permissions",

        "552_no_such_recipient",

        "552_5_2_2_mailbox_over_quota",

        "552_5_2_2_mailbox_full",
        "552_5_2_2_mailbox_full_variant_1",

        "554_does_not_exist",
        "554_no_such_recipient",
        "554_message_rejected",
        "554_reputation",
        "554_spam",

        "554_5_1_1_no_such_recipient",

        "554_5_2_2_mailbox_full",

        "554_5_2_3_policy_violation",

        "554_5_4_0_hops",

        "554_5_7_1_no_such_recipient",
        "554_5_7_1_no_such_recipient_variant_1",

        "554_5_7_1_spam_content",
        "554_5_7_1_spam_content_variant_1",
        "554_5_7_1_spam_content_variant_2",
        "554_5_7_1_spam_content_variant_3",
        "554_5_7_1_spam_content_variant_4",

        "554_5_7_105_sender_blocked",

        "554_5_7_7_equal_headers"
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
