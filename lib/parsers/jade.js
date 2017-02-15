"use strict";

var lexer = require('pug-lexer');
var parser = require('pug-parser');

function normalize(str) {
  if (typeof str !== 'string') {
    return;
  }
  return str.trim();
}

function wrapComment(str) {
  str = normalize(str);
  if (!str) {
    return;
  }
  return '/* ' + str + ' */';
}

function lines(isComment) {
  var v = [];

  function push(line, str) {
    str = isComment ? wrapComment(str) : normalize(str);
    if (!str) {
      return;
    }
    if (!isComment) {
      str += ';';
    }
    var i = line - 1;
    v[i] = v[i] || '';
    v[i] += str;
  }

  function value() {
    return v;
  }

  return {
    push: push,
    value: value
  };
}

function extractInterpolation(str) {
  if (str[0] !== '\'' && str[0] !== '"') {
    // not a string
    return;
  }
  var codeFragments = [];
  str.replace(/#{(.+?)}/g, function(expression, code) {
    codeFragments.push(code);
  });
  return codeFragments.join(';');
}

function eachNode(ast, fn) {
  if (!ast) {
    return;
  }
  fn(ast);
  if (Array.isArray(ast.nodes)) {
    ast.nodes.forEach(function(n) {
      eachNode(n, fn);
    });
  }
  eachNode(ast.block, fn);
  eachNode(ast.consequent, fn);
  eachNode(ast.alternate, fn);
}

function extractCode(ast, data) {
  eachNode(ast, function(node) {
    switch (node.type) {
      case 'Comment':
        data.comments.push(node.line, node.val);
        break;
      case 'Code':
        data.code.push(node.line, node.val);
        break;
      case 'Mixin':
        data.code.push(node.line, node.args);
        break;
    }
  });
}

function extractCodeFromAttributeTokens(tokens, data) {
  tokens
    .filter(function(token) {
      return token.type === 'attribute';
    })
    .forEach(function(token) {
      data.code.push(token.line, extractInterpolation(token.val) || token.val);
    });
}

function toJavaScript(data) {
  var code = data.code.value();
  var comments = data.comments.value();
  var lastComment = '';

  for(var l = 0; l < code.length; l++) {
    if (comments[l]) {
      lastComment = comments[l];
    }
    if (code[l] && lastComment) {
      code[l] = lastComment + ' ' + code[l];
      lastComment = '';
    }
  }

  return code.join('\n') + '\n';
}

function parseJade(str) {
  var data = {
    code: lines(),
    comments: lines(true)
  };

  var tokens = lexer(str);
  extractCodeFromAttributeTokens(tokens, data);

  var ast = parser(tokens);
  extractCode(ast, data);

  return toJavaScript(data);
}

// generate extracted strings file from Jade templates
exports.jade = function Jade(jadeSources, options) {
  Object.keys(jadeSources).forEach(function (filename) {
    jadeSources[filename] = parseJade(jadeSources[filename]);
  });

  return [jadeSources, options];
};
