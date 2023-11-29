"use strict";


var RE2                         = require("re2");
var { loopRegexes, trimString } = require("./utils");

var ERROR_CODES_TYPES = {
  "421"        : "service_not_available",
  "421 4.3.0"  : "temporary_system_problem",
  "421 4.4.5"  : "server_busy",
  "432 4.7.12" : "password_needed",
  "450"        : "mailbox_unavailable",
  "451"        : "local_error",
  "452"        : "insufficient_system_storage",
  "503"        : "bad_commands_sequence",
  "550"        : "action_not_taken",
  "550 5.1.1"  : "no_such_recipient",
  "550 5.2.1"  : "recipient_disabled_or_recipient_rate_limited",
  "550 5.7.1"  : "spam_content",
  "554"        : "transaction_failed",
  "554 5.7.1"  : "spam_content",
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
    /\(in reply to end of ([A-Z\s]+) command\)$/m, // 'end of' command
    /\(in reply to ([A-Z\s]+) command\)$/m, // default
    /timed out while sending ([A-Z\s]+)$/m, // command timed out
    /error after ([A-Z\s]+)/m // 'after' command
  ],

  email_server : [
    /host (\S+)\[([\d\.]+)\](?:\:(\d+)\:)? said/m,
    /\: connect to (.+)\[(.+)\](?:\:(\d+)\:)?/m,
    /Name service error for name\=(\S+)\s/m,
    /RCPT TO\:\<(.+?)\>/m,
    /Message rejected by\:\s+([\S\.]+?)$/m, // Outlook error
    /from (\S+) \[([\d\.]+)\](?:\:(\d+)\:)?/m
  ],

  error : [
    /said\: (\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+) \(in reply to/m,
    /said\: (\d{3}(?:[\s\-]\d\.\d\.\d\d?)?)-(.+)/m,
    /LMTP error after (?:.+?)\:\<.+?\>\: (\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) <.+?\>(.+)$/m,
    /Remote Server returned \'(\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+)\'/m,
    /The response from the remote server was:\s(\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+)/m,
    /refused to talk to me\: (\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+)/m,
    /Error\:\s*?(\d{3}(?:[\s\-]\d\.\d\.\d\d?)?) (.+)/m,
    /reason: (\d{3}[\s\-]\d\.\d\.\d\d?) (.+)/m,
    /(\d{3}[\s\-]\d\.\d\.\d\d?)/m
  ],

  recipient : [
    /The following addresses had permanent fatal errors (?:.*?)\s\<(.+?)\>/,
    /^\<(.+?)\>:/m,
    /^(.+?)\s?\n?\s*[\[|<]mailto\:(.+?)[\]|>]/m,
    /^Your message wasn't delivered to (.+?)\s/m,
    /^Your message to (.+?) couldn\'t/m,
    /\<(.+?)\>:/
  ],

  temporary_safe : /(temporary|temporarily)/i,
  blocked : /((?:is listed)blocked|banned|denied|dnsbl)/i,
  spam : /(spam)/i,

  enhanced_types_no_such_recipient : [
    /((?:user is terminated)|(?:invalid mailbox))/i
  ],

  error_code : [
    /(\d{3})[\s\-](\d\.\d\.\d)/,
    /(\d{3})/
  ],

  mailbox_address : [
    /^(([^\s@]+)@([^\s@]+)\.([^\s@]+))$/
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
      _temporary = false,
      _permanent = false;

    var _match = loopRegexes(this.__regexes.error, str, "match", false);

    if (_match && _match.length > 1) {
      _code  = this.__parseErrorCode(_match[1]);
      _label = trimString(_match[2]);

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
    }

    // Extract further data
    var _data = this.__parseErrorData(str, _code, _label);

    return {
      code      : _code,
      label     : _label,

      type      : ERROR_CODES_TYPES[(_code || {}).basic],

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

    if (code.basic) {
      if (code.enhanced) {
        _type = ERROR_CODES_TYPES[`${code.basic} ${code.enhanced}`] || null;
      } else {
        var _match = loopRegexes(this.__regexes.enhanced_types_no_such_recipient, str);

        if (_match && _match.length > 1) {
          _type = "no_such_recipient";
        }
      }
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
      _command = _match[1];
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
}


module.exports = Parser;
