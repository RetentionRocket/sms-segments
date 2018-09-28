(function () {
    var util = {

        map: function (sub, func) { return [].map.apply(sub, [func]); },
        concatMap: function (sub, func) { return [].concat.apply([], util.map(sub, func));},
        id: function (x) {return x;},
        isHighSurrogate: function (c) {
            var codeUnit = (c.charCodeAt != undefined) ? c.charCodeAt(0) : c;
            return codeUnit >= 0xD800 && codeUnit <= 0xDBFF;
        },
        /**
          take a string and return a list of the unicode characters
        */
        unicodeCharacters: function (string) {
            var chars = util.map(string, util.id);
            var result = [];
            while (chars.length > 0) {
                if (util.isHighSurrogate(chars[0])) {
                    result.push(chars.shift() + chars.shift());
                } else {
                    result.push(chars.shift());
                }
            }
            return result;
        },
    
        /**
          take a string and return a list of the unicode codepoints
        */
        unicodeCodePoints: function (string) {
            var charCodes = util.map(string, function (x) { return x.charCodeAt(0); });
            var result = [];
            while (charCodes.length > 0) {
                if (util.isHighSurrogate(charCodes[0])) {
                    var high = charCodes.shift();
                    var low = charCodes.shift();
                    result.push(((high - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000);
                } else {
                    result.push(charCodes.shift());
                }
            }
            return result;
        },
    
        /**
          Encode a single (unicode) character into UTF16 "bytes"
          A single unicode character may be 2 javascript characters
        */
        encodeCharUtf16: function (char) {
            return util.concatMap(char, function (c) {
                return [((0xff00 & c.charCodeAt(0)) >> 8), 0x00ff & c.charCodeAt(0)];
            });
        },
    
        /**
          Encode a single character into GSM0338 "bytes"
        */
        encodeCharGsm: function (char) {
            return unicodeToGsm[char.charCodeAt(0)];
        },
    
        _encodeEachWith: function (doEncode) {
            return function (s) {
                return util.map(util.unicodeCharacters(s), doEncode);
            };
        },
    
        pickencoding: function (s) {
            // choose gsm if possible otherwise ucs2
            if(util.unicodeCodePoints(s).every(function (x) {return x in unicodeToGsm; })) {
                return "gsm";
            } else {
                return "ucs2";
            }
        },
    
        nextChrLen: function (bytes, length) {
            return bytes[0] === undefined ? length : length + bytes[0].length;
        },
    
        _segmentWith: function (maxSingleSegmentSize, maxConcatSegmentSize, doEncode) {
            return function (listOfUnichrs) {
                var bytes = util.map(listOfUnichrs, doEncode);
          
                if (listOfUnichrs.length == 0) {
                  return [];
                } else if ([].concat.apply([], bytes).length <= maxSingleSegmentSize) {
                  return [{text: listOfUnichrs, bytes: bytes}];
                }
          
                var segments = [];
                while (listOfUnichrs.length > 0) {
                  var segment = {text: [], bytes: []};
                  var length = 0;
                  
                  while(listOfUnichrs.length > 0 && util.nextChrLen(bytes, length) <= maxConcatSegmentSize) {
                    var c = listOfUnichrs.shift();
                    var b = bytes.shift();
                    segment.text.push(c);
                    segment.bytes.push(b);
                    if(b != undefined) length += b.length;
                  }
                  segments.push(segment);
                }
                return segments;
            };
        }
    };
    
    var encoder = {
        gsm: util._encodeEachWith(util.encodeCharGsm),
        ucs2: util._encodeEachWith(util.encodeCharUtf16),
        auto: function (s) { return encoder[util.pickencoding(s)](s); }
    };
    
    
    var segmenter = {
        gsm: util._segmentWith(160, 153, util.encodeCharGsm),
        ucs2: util._segmentWith(140, 134, util.encodeCharUtf16),
        auto: function (s) { return segmenter[util.pickencoding(s)](s); }
    };
    
    var calculate = function () {
        var input = document.getElementById("sms-text").value;
        document.getElementById('smslc-characters').innerHTML = input.length;
        var inputCharacters = util.unicodeCharacters(input);
        var copy = JSON.parse(JSON.stringify(inputCharacters));
        var smsSegments = segmenter.auto(copy);
        document.getElementById('smslc-parts').innerHTML = smsSegments.length;
        var encoding = util.pickencoding(inputCharacters);
        if (encoding === 'gsm') {
            document.getElementById('smslc-encoding').innerHTML = '7bit';
            if (smsSegments.length > 1) {
                document.getElementById('smslc-characters-sms').innerHTML = 153;
            } else {
                document.getElementById('smslc-characters-sms').innerHTML = 160;
            }
        } else {
            document.getElementById('smslc-encoding').innerHTML = 'Unicode';
            if (smsSegments.length > 1) {
                document.getElementById('smslc-characters-sms').innerHTML = 67;
            } else {
                document.getElementById('smslc-characters-sms').innerHTML = 70;
            }
        }

        document.getElementById('sms-parts-container').innerHTML = '';
        for (var i = 0; i < smsSegments.length; i++) {
            for (var j = 0; j < smsSegments[i].text.length; j++) {
                var element = document.createElement("span");
                element.appendChild(document.createTextNode(smsSegments[i].text[j]));
                if (encoding === 'gsm' && smsSegments[i].bytes[j].length == 1) {
                    element.className = 'c7b';
                } else if (encoding === 'gsm' && smsSegments[i].bytes[j].length == 2) {
                    element.className = 'c7eb';
                } else if (encoding === 'ucs2') {
                    element.className = 'c16b';
                }
                
                document.getElementById('sms-parts-container').appendChild(element);
            }
            document.getElementById('sms-parts-container').appendChild(document.createElement("br"));
        }
    };
    
    document.getElementById("sms-text").addEventListener('input', calculate);
})();



