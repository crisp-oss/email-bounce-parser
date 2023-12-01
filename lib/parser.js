"use strict";


var RE2                         = require("re2");
var { loopRegexes, trimString } = require("./utils");

var ERROR_CODES_TYPES = {
  "421"        : "service_not_available",
  "421 4.3.0"  : "temporary_system_problem",
  "421 4.4.5"  : "server_busy",
  "421 4.7.28" : "ip_blocked_spam",
  "432 4.7.12" : "password_needed",
  "450"        : "action_not_taken_mailbox_unavailable",
  "450 4.2.1"  : "action_not_taken_mailbox_rate_limited",
  "451 4.4.2"  : "timeout",
  "451"        : "action_aborted_local_error",
  "451 4.5.0"  : "smtp_protocol_violation_rfc_2821",
  "452"        : "action_not_taken_insufficient_system_storage",
  "452 4.2.2"  : "mailbox_over_quota",
  "454"        : "smtp_protocol_violation_rfc_3207",
  "454 4.5.0"  : "smtp_protocol_violation_rfc_3207",
  "454 4.7.0"  : "authentication_issue",
  "455"        : "server_unable_to_accommodate_parameters",
  "500"        : "syntax_error",
  "501"        : "syntax_error_parameters",
  "501 5.5.2"  : "response_decode_error",
  "501 5.5.4"  : "invalid_helo_ehlo",
  "502"        : "command_not_implemented",
  "503"        : "bad_commands_sequence",
  "503 5.7.0"  : "no_identity_changes_permitted",
  "504"        : "parameter_not_implemented",
  "504 5.7.4"  : "unrecognized_authentication_type",
  "530 5.5.1"  : "authentication_required",
  "550"        : "action_not_taken",
  "550 5.1.1"  : "no_such_recipient",
  "550 5.2.1"  : "recipient_disabled_or_recipient_rate_limited",
  "550 5.7.1"  : "spam_content",
  "551"        : "user_not_local",
  "552"        : "action_aborted_exceeded_storage_allocation",
  "552 5.2.2"  : "mailbox_over_quota",
  "552 5.2.3"  : "message_size_limit",
  "553"        : "action_not_taken_mailbox_name_not_allowed",
  "554"        : "transaction_failed",
  "554 5.7.1"  : "spam_content",
  "555"        : "parameters_not_recognized",
  "555 5.5.2"  : "syntax_error"
};

var REGEXES = {
  line_break_double : /(\n\n)/gm,
  carriage_return : /\r\n/gm,
  byte_order_mark : /\uFEFF/gm,
  trailing_non_breaking_space : /\u00A0$/gm,
  non_breaking_space : /\u00A0/gm,
  line_break_double_indent_single : /(\n\n\ {2})/gm,
  line_break_single_indent_double : /(\n\ {4})/gm,
  indent_long : /(\ {14,})/gm,

  separator : [
    /(The mail system)/m,
    /(The following address\(es\) failed\:)/m
  ],

  command : [
    /\(in reply to end of ([A-Z\s]+) command\)$/m, // "in reply to end of DATA command"
    /\(in reply to ([A-Z\s]+) command\)$/m, // "in reply to RCPT TO command"
    /timed out while sending ([A-Z\s]+)$/m, // "timed out while sending (RCPT TO)", "timed out while sending RCPT TO"
    /error after ([A-Z\s]+)/i, // "LMTP error after RCPT TO"
    /while sending end of ([a-z\s]+)/i // "while sending end of data"
  ],

  email_server : [
    /host (\S+)\[([\d\.]+)\](?:\:(\d+)\:)? (?:said|refused to talk)/m,
    /^(\S+) rejected your message/m,
    /\: connect to (.+)\[(.+)\](?:\:(\d+)\:)?/m, // "connect to acme.com[132.145.223.95]:25:"
    /Name service error for name\=(\S+)\s/m,
    /RCPT TO\:\<(.+?)\>/m,
    /Message rejected by\:\s+([\S\.]+?)$/m, // Outlook error
    /from (\S+) \[([\d\.]+)\](?:\:(\d+)\:)?/m,
    /conversation with (\S+)\[([\d\.]+)\](?:\:(\d+)\:)? timed out/m,
    /Generating server: (\S+)(?:\[([\d\.]+)\])?(?:\:(\d+)\:)?/m // "Generating server: PH7PR02MB9549495.namprd02.prod.outlook.com"
  ],

  error : [
    /said\: (\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+) \(in reply to/,
    /said\: (\d{3}(?:[\s\-]\d\.\d\.\d\d?)?)-(.+)/,
    /(\d{3}\-\'\d\.\d\.\d\d?) (.+)/,
    /LMTP error after .+?\:\<.+?\>\: (\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) <.+?\>(.+)$/m,
    /remote server returned \'(\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+)\'/i,
    /The response from the remote server was:\s(\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+)/,
    /refused to talk to me\: (\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+)/,
    /(?:error|reason)\:\s*?(\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+)/i,
    /(\d{3}[\s\-]\d\.\d\.\d\d?)/,
    /(\d{3}\-\'\d\.\d\.\d\d?)/
  ],

  error_lax : [
    /^(?:\<.+?\> \(expanded from \<.+?\>\)\:)(.+)/m, // "<john@acme.com> (expanded from <john@digiflex.com>):  Domain name not found"
    /^(?:\<.+?\>\:)(.+)/m, // "<john@acme.com>: Domain name not found"
  ],

  error_label_cleanup_recipient : [
    /^\<.+?\> \(expanded from \<.+?\>\)\:/m, // "<john@acme.com> (expanded from <john@digiflex.com>):  Domain name not found"
    /^\<.+?\>\:/m, // "<john@acme.com>: Domain name not found"
  ],

  error_label_cleanup_command : [
    /\(in reply to (?:end of)?[A-Z\s]+ command\)$/m // "in reply to DATA command" or "in reply to end of DATA command"
  ],

  recipient : [
    /the following addresses had permanent fatal errors (?:.*?)\s\<(.+?)\>/i,
    /the following message to \<(.+?)\> was undeliverable/i,
    /to the following addresses:\s*(.+)/i,
    /^\<(.+?)\>:/m,
    /^(.+?)\s?\n?\s*[\[|<]mailto\:(.+?)[\]|>]/mi, // "john@acme.com<mailto:john@acme.com>"
    /^your message wasn't delivered to (.+?)\s/mi, // "Your message wasn't delivered to john@acme.com"
    /^your message to (.+?) couldn\'t/mi, // "Your message to john@acme.com couldn't"
    /\<(.+?)\> \(expanded from \<.+?\>\)\:/, // "<john@acme.com> (expanded from <john@digiflex.com>): "
    /\<(.+?)\>:/ // "<john@acme.com>:"
  ],

  temporary_safe : /(temporary|temporarily)/i,
  blocked : /((?:is listed)|blocked|banned|denied|dnsbl)/i,
  spam : /(spam)/i,

  enhanced_types_no_such_recipient : [
    /(recipient address rejected: access denied)/i, // Outlook DBEB for invalid addresses
    /(no such (?:account|user|mailbox|recipient))/i,
    /((?:terminated|disabled|inactive|not found|unavailable|invalid) (?:account|user|mailbox|recipient))/i,
    /(do(e)?sn\'t exist)/i, // Some Chinese SMTP return "dosn't" instead of "doesn't"
    /(user (?:.+?) does not exist)/i,
    /((?:account|user|mailbox|recipient) (?:.+@.+ )?(?:is )?(?:terminated|disabled|inactive|not found|unavailable|invalid))/i
  ],

  enhanced_types_server_unknown : [
    /(does not accept mail)/i,
    /(domain name not found)/i
  ],

  enhanced_types_server_timeout : [
    /(timeout|timed[\s\-]out)/i
  ],

  enhanced_types_mailbox_full : [
    /(out of storage|(?:mailbox (?:is )?full)|(?:user (?:is )?over quota))/i // "user is over quota" (iCloud)
  ],

  error_code : [
    /(\d{3})[\s\-](\d\.\d\.\d\d?)/,  // "550 5.4.1" or "550-5.4.1" or "550-5.4.11"
    /(\d{3})\-\'(\d\.\d\.\d\d?)/, // "550-'5.4.1" or "550-'5.4.11"
    /(\d{3})/ // "550"
  ]
};


/**
 * Parser
 * @class
 */
class Parser {
  /**
   * Constructor
   */
  constructor() {
    this.__regexes = {};

    this.__initRegexes();
  }


  /**
   * Parses the body of the email
   * @public
   * @param  {string} body
   * @return {object} The result
   */
  parseBody(body) {
    // Replace carriage return by regular line break
    var _body = body.replace(this.__regexes.carriage_return, "\n");

    // Remove Byte Order Mark
    _body = _body.replace(this.__regexes.byte_order_mark, "");

    // Remove trailing Non-breaking space
    _body = _body.replace(this.__regexes.trailing_non_breaking_space, "");

    // Replace Non-breaking space with regular space
    _body = _body.replace(this.__regexes.non_breaking_space, " ");

    var _match = loopRegexes(this.__regexes.separator, _body, "split");

    if (_match && _match.length > 2) {
      var _intro = trimString(_match[0] + _match[1]),
        _error = trimString(_match[2]);

      // Flatten intro?
      if (this.__lineLengthRestricted(_intro, 75)) {
        _intro = this.__flattenText(_intro);
      }

      // Flatten error?
      if (this.__lineLengthRestricted(_error, 80)) {
        _error = this.__flattenText(_error);
      }

      _body = _intro + "\n\n" + _error;

      return {
        body    : _body,
        intro   : _intro,
        error   : _error
      };
    }

    return {
      body : trimString(_body)
    };
  }


  /**
   * Parses the bounce email data
   * @public
   * @param  {string} body
   * @param  {string} [error]
   * @return {object} The parsed data
   */
  parseBounceData(body, error=null) {
    var _str = error || body;

    return {
      error     : this.__parseBounceDataError(_str),
      recipient : this.__parseBounceDataRecipient(_str),

      server    : this.__parseBounceDataEmailServer(_str),
      command   : this.__parseBounceDataCommand(_str)
    };
  }


  /**
   * Initializes regexes
   * @private
   * @return {undefined}
   */
  __initRegexes() {
    for (var _key in REGEXES) {
      var _key_line = `${_key}_line`;
      var _entry    = REGEXES[_key];

      if (Array.isArray(_entry)) {
        this.__regexes[_key]      = [];
        this.__regexes[_key_line] = [];

        for (var _i = 0; _i < _entry.length; _i++) {
          var _regex = _entry[_i];

          this.__regexes[_key].push(
            new RE2(_regex)
          );
        }
      } else {
        var _regex = _entry;

        this.__regexes[_key] = new RE2(_regex);
      }
    }
  }


  /**
   * Parses the bounce error
   * @private
   * @param  {string} str
   * @return {object} The bounce error
   */
  __parseBounceDataError(str) {
    var _code = {
      basic    : null,
      enhanced : null
    },
      _label = null,
      _type = null,
      _temporary = false,
      _permanent = false;

    var _match = loopRegexes(this.__regexes.error, str, "match", false);

    if (_match && _match.length > 1) {
      _code  = this.__parseErrorCode(_match[1]);
      _label = this.__cleanErrorLabel(_match[2]);

      // Check temporary / permanent
      if (_code.basic[0] === "4") {
        _temporary = true;
      } else if (_code.basic[0] === "5") {
        _permanent = true;
      }

      // Make sure the bounce is actually permanent
      if (_permanent === true) {
        var _match = this.__regexes.temporary_safe.match(str);

        if (_match && _match.length > 1) {
          _temporary = true;
          _permanent = false;
        }
      }

      if (_code.basic) {
        _type = ERROR_CODES_TYPES[_code.basic] || null
      }
    }

    // No label detected? Probably because there's no error code
    if (!_label) {
      // Attempt a lax check
      var _match = loopRegexes(this.__regexes.error_lax, str);

      if (_match && _match.length > 1) {
        _label = this.__cleanErrorLabel(_match[1]);
      }
    }

    // Extract further data
    var _data = this.__parseErrorData(str, _code, _label);

    return {
      code      : _code,
      label     : _label,

      type      : _type,

      temporary : _temporary,
      permanent : _permanent,

      data      : _data
    }
  }


  /**
   * Parses the error code
   * @private
   * @param  {string} code
   * @return {object} The error code
   */
  __parseErrorCode(code) {
    var _basic = null,
      _enhanced = null;

    var _match = loopRegexes(this.__regexes.error_code, code);

    if (_match && _match.length > 1) {
      _basic = _match[1];
      _enhanced = _match[2] || null;
    }

    // Basic code is the enhanced code? This is wrong and should be fixed
    if (_basic === "511") {
      _basic = "550";
      _enhanced = "5.1.1";
    }

    return {
      basic    : _basic,
      enhanced : _enhanced
    }
  }


  /**
   * Parses the error data
   * @private
   * @param  {string} str
   * @param  {object} code
   * @param  {string} label
   * @return {object} The error data
   */
  __parseErrorData(str, code, label) {
    var _type = null,
      _blocked = false,
      _spam = false;

    // Detect enhanced-type from bounce content
    var _match = loopRegexes(this.__regexes.enhanced_types_no_such_recipient, str);

    if (_match && _match.length > 1) {
      _type = "no_such_recipient";
    }

    _match = loopRegexes(this.__regexes.enhanced_types_server_unknown, str);

    if (!_type && _match && _match.length > 1) {
      _type = "server_unknown";
    }

    _match = loopRegexes(this.__regexes.enhanced_types_server_timeout, str);

    if (!_type && _match && _match.length > 1) {
      _type = "server_timeout";
    }

    _match = loopRegexes(this.__regexes.enhanced_types_mailbox_full, str);

    if (!_type && _match && _match.length > 1) {
      _type = "mailbox_full";
    }

    // Detect enhanced-type from enhanced error code
    // Notice: this is done as a last resort, as sometimes enhanced code \
    //   doesn't clearly convey the actual error
    if (!_type && _match && code.enhanced) {
      _type = ERROR_CODES_TYPES[`${code.basic} ${code.enhanced}`] || null;
    }

    // Check if blocked
    var _blocked_match = this.__regexes.blocked.match(str);

    if (_blocked_match && _blocked_match.length > 1) {
      _blocked = true;
    }

    // Check if spam
    var _spam_match = this.__regexes.spam.match(str);

    if (_spam_match && _spam_match.length > 1) {
      _spam = true;
    }

    return {
      type    : _type,
      blocked : _blocked,
      spam    : _spam
    }
  }


  /**
   * Parses the recipient
   * @private
   * @param  {string} str
   * @return {object} The recipient email address
   */
  __parseBounceDataRecipient(str) {
    var _recipient = null;

    var _match = loopRegexes(this.__regexes.recipient, str);

    if (_match && _match.length > 1) {
      _recipient = trimString(_match[1]);
    }

    return _recipient;
  }


  /**
   * Parses the email server
   * @private
   * @param  {string} str
   * @return {object} The email server
   */
  __parseBounceDataEmailServer(str) {
    var _hostname = null,
      _ip = null,
      _port = null;

    var _match = loopRegexes(this.__regexes.email_server, str);

    if (_match && _match.length > 1) {
      _hostname = this.__parseHostname(_match[1]);
      _ip       = _match[2] || null;
      _port     = _match[3] || null;
    }

    return {
      hostname : _hostname,
      ip       : _ip,
      port     : _port || null
    }
  }


  /**
   * Parses the server hostname
   * @private
   * @param  {string} hostname
   * @return {object} The server hostname
   */
  __parseHostname(hostname) {
    if (hostname.includes("@")) {
      return hostname.split("@")[1];
    }

    return hostname;
  }


  /**
   * Parses the command
   * @private
   * @param  {string} str
   * @return {object} The parsed command
   */
  __parseBounceDataCommand(str) {
    var _command = null;

    var _match = loopRegexes(this.__regexes.command, str);

    if (_match && _match.length > 1) {
      _command = trimString(_match[1]).toUpperCase();
    }

    return _command;
  }


  /**
   * Checks whether line length is restricted
   * @private
   * @param  {string}  str
   * @param  {string}  length
   * @return {boolean} Whether line length is restricted or not
   */
  __lineLengthRestricted(str, length) {
    var _lines = str.split("\n");

    for (var _i = 0; _i < _lines.length; _i++) {
      var _line = _lines[_i];

      // Skip lines with URL, as they are usually not restricted in length
      if (_line.length > length && !_line.includes("http")) {
        return false;
      }
    }

    return true;
  }


  /**
   * Flattens text
   * @private
   * @param  {string} str
   * @return {string} Flattened text
   */
  __flattenText(str) {
    var _str = str;

    // Replace Line-break followed by double indent with regular space
    _str = _str.replace(this.__regexes.line_break_single_indent_double, " ");

    // Replace double Line-break followed by single indent with double Line-break
    _str = _str.replace(this.__regexes.line_break_double_indent_single, "\n\n");

    // Replace single Line-break with regular space
    _str = _str.replace(/(?<!\n)\n(?!\n)/gm, " ");

    // Replace long indent with double Line-break
    _str = _str.replace(this.__regexes.indent_long, "\n\n");

    return _str;
  }


  /**
   * Cleans error label
   * @private
   * @param  {string} [label]
   * @return {string} Unquoted text
   */
  __cleanErrorLabel(label="") {
    var _label = this.__unquoteText(label);

    _label = trimString(_label);

    // Strip recipient (at the beginning) and command (at the end), in case \
    //   they are still present
    _label = loopRegexes(this.__regexes.error_label_cleanup_recipient, _label, "replace");
    _label = loopRegexes(this.__regexes.error_label_cleanup_command, _label, "replace");

    _label = trimString(_label);

    return _label;
  }


  /**
   * Unquotes text
   * @private
   * @param  {string} [str]
   * @return {string} Unquoted text
   */
  __unquoteText(str="") {
    var _str = str;

    _str = trimString(_str);

    if (
      (_str.startsWith("'") && _str.endsWith("'")) ||
      (_str.startsWith("\"") && _str.endsWith("\""))
    ) {
      return _str.slice(1, -1);
    }

    return _str;
  }
}


module.exports = Parser;
