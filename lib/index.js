"use strict";


var Parser = require("./parser");


/**
 * EmailBounceParser
 * @class
 */
class EmailBounceParser {
  /**
   * Constructor
   */
  constructor() {
    this.parser = new Parser();
  }

  /**
   * Attempts to parse a bounce email
   * @public
   * @param  {string} body
   * @return {object} The parsed email
   */
  read(body) {
    var _result = this.parser.cleanBody(body);

    var _data   = this.parser.parseBounceData(_result.body)

    return {
      bounce  : true,

      email   : {
        body : _result.body
      },

      data    : {
        error   : _data.error,

        server  : _data.server,
        command : _data.command
      }
    }
  };
};


module.exports = EmailBounceParser;

