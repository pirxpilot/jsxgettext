"use strict";

var lexer = require('pug-lexer');

// From MDN:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Using_Special_Characters
function escapeRegExp(string) {
  return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
}

function parseJade(str, options) {
  options = options || {};

  options.keyword = options.keyword || ['gettext'];

  var gettextRegexPrefix = '\\w*(?:' + options.keyword.map(escapeRegExp).join('|') + ')';
  var argRegex = /\s*(?:"[^"]+"|'[^']+')\s*/;
  var gettexRegex = new RegExp(gettextRegexPrefix + '\\(' + argRegex.source + '(?:,' + argRegex.source + ')?', 'gi');

  function extractGettext(str) {
    if (typeof(str) !== 'string') return;

    var tmp = str.match(gettexRegex);

    if (!tmp) return;

    return tmp.map(function (t) {
      return t + ')';
    }).join(';');
  }

  var buf = [];

  function append(text, offset) {
    if (!text) {
      return
    }
    /* jshint -W040 */
    var line = this.line + (offset || 0) - 1;
      buf[line] = [buf[line], text, ';'].join('');
  }

  var token;
  var tokens = lexer(str);

  for(var i = 0; i < tokens.length; i++) {
    token = tokens[i];
    switch (token.type) {
      case 'call':
        append.call(token, extractGettext(token.args));
        break;
      case 'attribute':
      case 'text':
      case 'code':
      case 'interpolated-code':
        append.call(token, extractGettext(token.val));
        break;
      case 'pipeless-text':
        token.line -= token.val.length - 1;
        token.val
          .map(extractGettext)
          .forEach(append, token);
        break;
      case 'comment':
        if (/^\s*L10n:/.test(token.val)) {
          append.call(token, ['/*', token.val, '*/'].join(''));
        }
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
