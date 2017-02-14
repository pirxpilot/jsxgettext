"use strict";

var lexer = require('pug-lexer');

var argRegex = /\s*(?:"[^"]+"|'[^']+')\s*/;
var fnRegex = new RegExp('\\w+\\s*' + '\\(' + argRegex.source + '(?:,' + argRegex.source + ')?', 'gi');

function parseJade(str) {

  function extractFunctions(str) {
    if (typeof(str) !== 'string') return;

    var functions = [];

    str.replace(fnRegex, function(f) {
      functions.push(f + ')');
    });

    return functions.join(';');
  }

  var buf = [];
  var lastComment;

  function append(text) {
    if (!text) return;
    /* jshint -W040 */
    var line = this.line - 1;
    buf[line] = [lastComment, buf[line], text, ';'].join('');
    lastComment = undefined;
  }

  var token;
  var tokens = lexer(str);

  for(var i = 0; i < tokens.length; i++) {
    token = tokens[i];
    switch (token.type) {
      case 'call':
        append.call(token, extractFunctions(token.args));
        break;
      case 'attribute':
      case 'text':
      case 'code':
      case 'interpolated-code':
        append.call(token, extractFunctions(token.val));
        break;
      case 'pipeless-text':
        token.line -= token.val.length - 1;
        token.val
          .map(extractFunctions)
          .forEach(append, token);
        break;
      case 'comment':
        lastComment = [' /*', token.val, '*/ '].join('');
        break;
    }
  }

  return buf.join('\n');
}

// generate extracted strings file from Jade templates
exports.jade = function Jade(jadeSources, options) {
  Object.keys(jadeSources).forEach(function (filename) {
    jadeSources[filename] = parseJade(jadeSources[filename], options);
  });

  return [jadeSources, options];
};
