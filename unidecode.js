/**
 * Unidecode-plus takes full-range Unicode text and tries to represent it using only US-ASCII characters (i.e., the
 * universally displayable characters between 0x00 and 0x7F). The representation is generally an attempt at
 * transliteration -- i.e., conveying, in Roman letters, the pronunciation expressed by the text in some other writing
 * system. Some of the transliterations go for matching the _shape_ of characters rather than their pronunciation, such
 * as transliterating the Greek letter `ρ` (rho) as the ASCII `p`, even though it sounds more like an `r`. Various
 * emojis are represented either as "ASCII art" or English text.
 *
 * The tables used (in data) are converted from the tables provided in the Perl libraryText::Unidecode
 * (http://search.cpan.org/dist/Text-Unidecode/lib/Text/Unidecode.pm) and are distributed under the Perl license.
 *
 * Whereas the original JavaScript and Perl versions of Unidecode only worked the Unicode Basic Multilingual Plane
 * (BMP, U+0 to U+FFFF), this version also handles transliteration of some characters beyond the BMP, like popular
 * emojis.
 *
 * @author Kerry Shetline
 *
 * Based on Francois-Guillaume Ribreau's unidecode, which in turn was based on a port of unidecode for Perl.
 */

'use strict';

require('./polyfills');

var tr = {};
var codepoints;

try {
  // Can we use Unicode-aware regexes?
  codepoints = /[^\x00-\x7F]/gu; // jshint ignore:line
}
catch (err) {
  // Nope! This mess will have to do.
  codepoints = /(?:[\x80-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF])/g;
}

var german = false;
var deferredSmartSpacing = false;
var smartSpacing = false;
var skipRanges;

module.exports = function unidecode(str, options) {
  if (!str) return '';
  
  german = options && options.german;
  deferredSmartSpacing = options && options.deferredSmartSpacing;
  smartSpacing = deferredSmartSpacing || (options && options.smartSpacing);
  skipRanges = options && options.skipRanges;

  if (german)
    str = str.replace(/([AOU])\u0308/g, '$1E').replace(/([aou])\u0308/g, '$1e');

  str = str.replace(codepoints, unidecode_internal_replace);

  if (!smartSpacing || deferredSmartSpacing)
    return str;
  else
    return resolveSpacing(str);
};

function unidecode_internal_replace(ch) {
  var cp = ch.codePointAt(0), ch0 = ch;

  if (skipRanges) {
    for (var i = 0; i < skipRanges.length; ++i) {
        if (skipRanges[i][0] <= cp && cp <= skipRanges[i][1])
            return ch;
    }
  }

  var high = cp >> 8;
  var row = high + (high === 0 && german ? 0.5 : 0);
  var low = cp & 0xFF;
  var emDash = cp === 0x2014;
  // This doesn't cover all emoji, just those currently defined.
  var emoji = (high === 0x1F4 || high === 0x1F6 || high === 0x1F9);

  if (0x18 < high && high < 0x1E || 0xD7 < high && high < 0xF9)
    return ''; // Isolated high or low surrogate
  else if (high > 0xFF && !emoji) {
    return '_';
  }

  if (!tr[row]) {
    try {
      tr[row] = require('./data/x' + (row < 0x10 ? '0' : '') + row.toString(16));

      // I'm not sure why, but a fair number of the original data tables don't contain a full 256 items.
      if (tr[row].length < 256) {
        var start = tr[row].length;
        tr[row].length = 256;
        tr[row].fill('_', start);
      }
    }
    catch (err) {
      tr[row] = new Array(256).fill('_');
    }
  }

  ch = tr[row][low];

  if (smartSpacing && emDash)
    return '\x80--\x80';
  if (!smartSpacing || ch === '[?]' || ch === '_' || /^\w+$/.test(ch))
    return ch;
  else if (emoji)
    return '\x80\x81' + ch + '\x81\x80';
  else
    return '\x80' + ch.trim() + '\x80';
}

function resolveSpacing(str) {
  return str
    .replace(/(\w)(\x80--\x80)(\w)/g, function(_, p1, _2, p3) { return p1 + ' - ' + p3; })
    .replace(/\x80(?!\w)/g, "")
    .replace(/\x80\x80|(\w)\x80/g, "$1\x81")
    .replace(/\x80/g, "")
    .replace(/^\x81+|\x81+$/g, "")
    .replace(/\x81 \x81/g, "  ")
    .replace(/\s?\x81+/g, " ");
}

module.exports.resolveSpacing = resolveSpacing;
