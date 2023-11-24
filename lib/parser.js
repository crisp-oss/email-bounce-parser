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
  "550"        : "message_rejected",
  "554"        : "transaction_failed",

var REGEXES = {
  double_line_break : /(\n\n)/gm,
  carriage_return : /\r\n/gm,
  byte_order_mark : /\uFEFF/gm,
  trailing_non_breaking_space : /\u00A0$/gm,
  non_breaking_space : /\u00A0/gm,
  line_break_indent : /(\n\ {4})/gm,
  long_indent : /(\ {14,})/gm,

  command : [
    /\(in reply to end of (?<end_command>.+) command\)$/m, // 'end of' command
    /\(in reply to (.+) command\)$/m // default
  ],

  email_server : [
    /host (.+)\[(.+)\] said/m
  ],

  error : [
    /said\: (\d+) (.+) \(in reply to/m
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
   * Cleans the body
   * @public
   * @param  {string} body
   * @return {object} The result
   */
  cleanBody(body) {
    // Replace carriage return by regular line break
    var _body = body.replace(this.__regexes.carriage_return, "\n");

    // Remove Byte Order Mark
    _body = _body.replace(this.__regexes.byte_order_mark, "");

    // Remove trailing Non-breaking space
    _body = _body.replace(this.__regexes.trailing_non_breaking_space, "");

    // Replace Non-breaking space with regular space
    _body = _body.replace(this.__regexes.non_breaking_space, " ");

    // Replace Line-break followed by indent with regular space
    _body = _body.replace(this.__regexes.line_break_indent, " ");

    // Replace single Line-break with regular space
    _body = _body.replace(/(?<!\n)\n(?!\n)/gm, " ");

    // Replace long indent with double Line-break
    _body = _body.replace(this.__regexes.long_indent, "\n\n");

    return {
      body : trimString(_body)
    };
  }


  /**
   * Parses the bounce email data
   * @public
   * @param  {string} body
   * @return {object} The parsed data
   */
  parseBounceData(body) {
    return {
      error   : this.__parseBounceDataError(body),

      server  : this.__parseBounceDataEmailServer(body),
      command : this.__parseBounceDataCommand(body)
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
   * @param  {string} body
   * @return {object} The bounce error
   */
  __parseBounceDataError(body) {
    let _code = null,
      _label = null;

    var _match = loopRegexes(this.__regexes.error, body);

    if (_match && _match.length > 2) {
      _code  = _match[1];
      _label = _match[2];
    }

    return {
      code    : _code,
      label   : _label,

      type    : ERROR_CODES_TYPES[_code],
    }
  }


  /**
   * Parses the email server
   * @private
   * @param  {string} body
   * @return {object} The email server
   */
  __parseBounceDataEmailServer(body) {
    let _hostname = null,
      _ip = null;

    var _match = loopRegexes(this.__regexes.email_server, body);

    if (_match && _match.length > 1) {
      _hostname = _match[1];
      _ip       = _match[2];
    }

    return {
      hostname : _hostname,
      ip       : _ip
    }
  }


  /**
   * Parses the command
   * @private
   * @param  {string} body
   * @return {object} The parsed command
   */
  __parseBounceDataCommand(body) {
    let _command = null,
      _end = false;

    var _match = loopRegexes(this.__regexes.command, body);

    if (_match && _match.length > 1) {
      _command = _match[1];

      if (_match.groups && _match.groups.end_command) {
        _end = true;
      }
    }

    return {
      command : _command,
      end     : _end
    }
  }
}


module.exports = Parser;
