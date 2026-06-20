/*!
 * qrcode-generator — self-contained, dependency-free QR Code generator.
 * Based on the algorithm by Kazuhiko Arase (MIT License).
 * Trimmed to byte mode + numeric/alphanumeric, which is all Dragon Dash needs
 * (a short same-origin URL), so the game keeps working fully offline.
 *
 * Usage:
 *   const qr = qrcode(0, 'M');     // 0 = auto-pick the smallest fitting version
 *   qr.addData('https://example'); // UTF-8 byte mode
 *   qr.make();
 *   qr.renderToCanvas(ctx, x, y, size, { dark:'#000', light:'#fff' });
 */
var qrcode = (function () {
  // ---- QRMode ----
  var QRMode = { MODE_NUMBER: 1 << 0, MODE_ALPHA_NUM: 1 << 1, MODE_8BIT_BYTE: 1 << 2 };

  // ---- QRErrorCorrectionLevel ----
  var QRErrorCorrectionLevel = { L: 1, M: 0, Q: 3, H: 2 };

  // ---- QRMaskPattern ----
  var QRMaskPattern = {
    PATTERN000: 0, PATTERN001: 1, PATTERN010: 2, PATTERN011: 3,
    PATTERN100: 4, PATTERN101: 5, PATTERN110: 6, PATTERN111: 7
  };

  // ---- QRMath ----
  var QRMath = (function () {
    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);
    for (var i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i;
    for (i = 8; i < 256; i++) {
      EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
    }
    for (i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]] = i;
    return {
      glog: function (n) { if (n < 1) throw new Error('glog(' + n + ')'); return LOG_TABLE[n]; },
      gexp: function (n) { while (n < 0) n += 255; while (n >= 256) n -= 255; return EXP_TABLE[n]; }
    };
  })();

  // ---- QRPolynomial ----
  function QRPolynomial(num, shift) {
    if (num.length === undefined) throw new Error(num.length + '/' + shift);
    var offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
  }
  QRPolynomial.prototype = {
    getAt: function (i) { return this.num[i]; },
    getLength: function () { return this.num.length; },
    multiply: function (e) {
      var num = new Array(this.getLength() + e.getLength() - 1);
      for (var i = 0; i < this.getLength(); i++) {
        for (var j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.getAt(i)) + QRMath.glog(e.getAt(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod: function (e) {
      if (this.getLength() - e.getLength() < 0) return this;
      var ratio = QRMath.glog(this.getAt(0)) - QRMath.glog(e.getAt(0));
      var num = new Array(this.getLength());
      for (var i = 0; i < this.getLength(); i++) num[i] = this.getAt(i);
      for (var j = 0; j < e.getLength(); j++) {
        num[j] ^= QRMath.gexp(QRMath.glog(e.getAt(j)) + ratio);
      }
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  // ---- QRRSBlock ----
  function QRRSBlock(totalCount, dataCount) {
    this.totalCount = totalCount; this.dataCount = dataCount;
  }
  QRRSBlock.RS_BLOCK_TABLE = [
    [1,26,19],[1,26,16],[1,26,13],[1,26,9],
    [1,44,34],[1,44,28],[1,44,22],[1,44,16],
    [1,70,55],[1,70,44],[2,35,17],[2,35,13],
    [1,100,80],[2,50,32],[2,50,24],[4,25,9],
    [1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],
    [2,86,68],[4,43,27],[4,43,19],[4,43,15],
    [2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],
    [2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],
    [2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],
    [2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],
    [4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],
    [2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],
    [4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],
    [3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],
    [5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],
    [5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],
    [1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],
    [5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],
    [3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],
    [3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],
    [4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],
    [2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],
    [4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],
    [6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],
    [8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],
    [10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],
    [8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],
    [3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],
    [7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],
    [5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],
    [13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],
    [17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],
    [17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],
    [13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],
    [12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],
    [6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],
    [17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],
    [4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],
    [20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],
    [19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]
  ];
  QRRSBlock.getRSBlocks = function (typeNumber, errorCorrectionLevel) {
    var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectionLevel);
    if (rsBlock === undefined) {
      throw new Error('bad rs block @ typeNumber:' + typeNumber + '/errorCorrectionLevel:' + errorCorrectionLevel);
    }
    var length = rsBlock.length / 3;
    var list = [];
    for (var i = 0; i < length; i++) {
      var count = rsBlock[i * 3 + 0];
      var totalCount = rsBlock[i * 3 + 1];
      var dataCount = rsBlock[i * 3 + 2];
      for (var j = 0; j < count; j++) list.push(new QRRSBlock(totalCount, dataCount));
    }
    return list;
  };
  QRRSBlock.getRsBlockTable = function (typeNumber, errorCorrectionLevel) {
    switch (errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default: return undefined;
    }
  };

  // ---- QRBitBuffer ----
  function QRBitBuffer() { this.buffer = []; this.length = 0; }
  QRBitBuffer.prototype = {
    getBuffer: function () { return this.buffer; },
    getAt: function (index) {
      var bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) === 1;
    },
    put: function (num, length) {
      for (var i = 0; i < length; i++) this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    },
    getLengthInBits: function () { return this.length; },
    putBit: function (bit) {
      var bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  // ---- byte / utf-8 helpers ----
  function toUtf8ByteArray(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
      else if (c < 0xd800 || c >= 0xe000) {
        bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f));
      } else {
        i++;
        var cp = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
        bytes.push(0xf0 | (cp >> 18)); bytes.push(0x80 | ((cp >> 12) & 0x3f));
        bytes.push(0x80 | ((cp >> 6) & 0x3f)); bytes.push(0x80 | (cp & 0x3f));
      }
    }
    return bytes;
  }

  // ---- QR8bitByte data ----
  function QR8bitByte(data) {
    this.mode = QRMode.MODE_8BIT_BYTE;
    this.data = data;
    this.bytes = toUtf8ByteArray(data);
  }
  QR8bitByte.prototype = {
    getLength: function () { return this.bytes.length; },
    write: function (buffer) { for (var i = 0; i < this.bytes.length; i++) buffer.put(this.bytes[i], 8); }
  };

  // ---- QRUtil ----
  var QRUtil = (function () {
    var PATTERN_POSITION_TABLE = [
      [],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],
      [6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],
      [6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],
      [6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],
      [6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],
      [6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],
      [6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    function getBCHDigit(data) { var digit = 0; while (data !== 0) { digit++; data >>>= 1; } return digit; }
    return {
      PATTERN_POSITION_TABLE: PATTERN_POSITION_TABLE,
      getBCHTypeInfo: function (data) {
        var d = data << 10;
        while (getBCHDigit(d) - getBCHDigit(G15) >= 0) d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15)));
        return ((data << 10) | d) ^ G15_MASK;
      },
      getBCHTypeNumber: function (data) {
        var d = data << 12;
        while (getBCHDigit(d) - getBCHDigit(G18) >= 0) d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18)));
        return (data << 12) | d;
      },
      getPatternPosition: function (typeNumber) { return PATTERN_POSITION_TABLE[typeNumber - 1]; },
      getMaskFunction: function (maskPattern) {
        switch (maskPattern) {
          case QRMaskPattern.PATTERN000: return function (i, j) { return (i + j) % 2 === 0; };
          case QRMaskPattern.PATTERN001: return function (i) { return i % 2 === 0; };
          case QRMaskPattern.PATTERN010: return function (i, j) { return j % 3 === 0; };
          case QRMaskPattern.PATTERN011: return function (i, j) { return (i + j) % 3 === 0; };
          case QRMaskPattern.PATTERN100: return function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; };
          case QRMaskPattern.PATTERN101: return function (i, j) { return (i * j) % 2 + (i * j) % 3 === 0; };
          case QRMaskPattern.PATTERN110: return function (i, j) { return ((i * j) % 2 + (i * j) % 3) % 2 === 0; };
          case QRMaskPattern.PATTERN111: return function (i, j) { return ((i * j) % 3 + (i + j) % 2) % 2 === 0; };
          default: throw new Error('bad maskPattern:' + maskPattern);
        }
      },
      getErrorCorrectPolynomial: function (errorCorrectLength) {
        var a = new QRPolynomial([1], 0);
        for (var i = 0; i < errorCorrectLength; i++) a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
        return a;
      },
      getLengthInBits: function (mode, type) {
        if (1 <= type && type < 10) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 10;
            case QRMode.MODE_ALPHA_NUM: return 9;
            case QRMode.MODE_8BIT_BYTE: return 8;
            default: throw new Error('mode:' + mode);
          }
        } else if (type < 27) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 12;
            case QRMode.MODE_ALPHA_NUM: return 11;
            case QRMode.MODE_8BIT_BYTE: return 16;
            default: throw new Error('mode:' + mode);
          }
        } else if (type < 41) {
          switch (mode) {
            case QRMode.MODE_NUMBER: return 14;
            case QRMode.MODE_ALPHA_NUM: return 13;
            case QRMode.MODE_8BIT_BYTE: return 16;
            default: throw new Error('mode:' + mode);
          }
        } else throw new Error('type:' + type);
      },
      getLostPoint: function (qrcode) {
        var moduleCount = qrcode.getModuleCount();
        var lostPoint = 0;
        // rule 1
        for (var row = 0; row < moduleCount; row++) {
          for (var col = 0; col < moduleCount; col++) {
            var sameCount = 0;
            var dark = qrcode.isDark(row, col);
            for (var r = -1; r <= 1; r++) {
              if (row + r < 0 || moduleCount <= row + r) continue;
              for (var c = -1; c <= 1; c++) {
                if (col + c < 0 || moduleCount <= col + c) continue;
                if (r === 0 && c === 0) continue;
                if (dark === qrcode.isDark(row + r, col + c)) sameCount++;
              }
            }
            if (sameCount > 5) lostPoint += (3 + sameCount - 5);
          }
        }
        // rule 2
        for (row = 0; row < moduleCount - 1; row++) {
          for (col = 0; col < moduleCount - 1; col++) {
            var count = 0;
            if (qrcode.isDark(row, col)) count++;
            if (qrcode.isDark(row + 1, col)) count++;
            if (qrcode.isDark(row, col + 1)) count++;
            if (qrcode.isDark(row + 1, col + 1)) count++;
            if (count === 0 || count === 4) lostPoint += 3;
          }
        }
        // rule 3
        for (row = 0; row < moduleCount; row++) {
          for (col = 0; col < moduleCount - 6; col++) {
            if (qrcode.isDark(row, col) && !qrcode.isDark(row, col + 1) && qrcode.isDark(row, col + 2) &&
                qrcode.isDark(row, col + 3) && qrcode.isDark(row, col + 4) && !qrcode.isDark(row, col + 5) &&
                qrcode.isDark(row, col + 6)) lostPoint += 40;
          }
        }
        for (col = 0; col < moduleCount; col++) {
          for (row = 0; row < moduleCount - 6; row++) {
            if (qrcode.isDark(row, col) && !qrcode.isDark(row + 1, col) && qrcode.isDark(row + 2, col) &&
                qrcode.isDark(row + 3, col) && qrcode.isDark(row + 4, col) && !qrcode.isDark(row + 5, col) &&
                qrcode.isDark(row + 6, col)) lostPoint += 40;
          }
        }
        // rule 4
        var darkCount = 0;
        for (col = 0; col < moduleCount; col++) {
          for (row = 0; row < moduleCount; row++) {
            if (qrcode.isDark(row, col)) darkCount++;
          }
        }
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;
        return lostPoint;
      }
    };
  })();

  // ---- QRCodeModel ----
  function QRCodeModel(typeNumber, errorCorrectionLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectionLevel = errorCorrectionLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  var PAD0 = 0xEC, PAD1 = 0x11;
  QRCodeModel.prototype = {
    addData: function (data) { this.dataList.push(new QR8bitByte(data)); this.dataCache = null; },
    isDark: function (row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) throw new Error(row + ',' + col);
      return this.modules[row][col];
    },
    getModuleCount: function () { return this.moduleCount; },
    make: function () { this.makeImpl(false, this.getBestMaskPattern()); },
    makeImpl: function (test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (var col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.typeNumber >= 7) this.setupTypeNumber(test);
      if (this.dataCache === null) {
        this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectionLevel, this.dataList);
      }
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern: function (row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          this.modules[row + r][col + c] =
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4);
        }
      }
    },
    getBestMaskPattern: function () {
      var minLostPoint = 0, pattern = 0;
      for (var i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        var lostPoint = QRUtil.getLostPoint(this);
        if (i === 0 || minLostPoint > lostPoint) { minLostPoint = lostPoint; pattern = i; }
      }
      return pattern;
    },
    setupTimingPattern: function () {
      for (var r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] !== null) continue;
        this.modules[r][6] = (r % 2 === 0);
      }
      for (var c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] !== null) continue;
        this.modules[6][c] = (c % 2 === 0);
      }
    },
    setupPositionAdjustPattern: function () {
      var pos = QRUtil.getPatternPosition(this.typeNumber);
      for (var i = 0; i < pos.length; i++) {
        for (var j = 0; j < pos.length; j++) {
          var row = pos[i], col = pos[j];
          if (this.modules[row][col] !== null) continue;
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              this.modules[row + r][col + c] =
                r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
            }
          }
        }
      }
    },
    setupTypeNumber: function (test) {
      var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
      var i;
      for (i = 0; i < 18; i++) {
        var mod = (!test && ((bits >> i) & 1) === 1);
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
      }
      for (i = 0; i < 18; i++) {
        var mod2 = (!test && ((bits >> i) & 1) === 1);
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod2;
      }
    },
    setupTypeInfo: function (test, maskPattern) {
      var data = (this.errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);
      var i, mod;
      for (i = 0; i < 15; i++) {
        mod = (!test && ((bits >> i) & 1) === 1);
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;
      }
      for (i = 0; i < 15; i++) {
        mod = (!test && ((bits >> i) & 1) === 1);
        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = (!test);
    },
    mapData: function (data, maskPattern) {
      var inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);
      for (var col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null) {
              var dark = false;
              if (byteIndex < data.length) dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
              var mask = maskFunc(row, col - c);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex === -1) { byteIndex++; bitIndex = 7; }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) { row -= inc; inc = -inc; break; }
        }
      }
    }
  };
  QRCodeModel.createData = function (typeNumber, errorCorrectionLevel, dataList) {
    var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);
    var buffer = new QRBitBuffer();
    for (var i = 0; i < dataList.length; i++) {
      var data = dataList[i];
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber));
      data.write(buffer);
    }
    var totalDataCount = 0;
    for (i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
    if (buffer.getLengthInBits() > totalDataCount * 8) {
      throw new Error('code length overflow. (' + buffer.getLengthInBits() + '>' + totalDataCount * 8 + ')');
    }
    if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.getLengthInBits() % 8 !== 0) buffer.putBit(false);
    while (true) {
      if (buffer.getLengthInBits() >= totalDataCount * 8) break;
      buffer.put(PAD0, 8);
      if (buffer.getLengthInBits() >= totalDataCount * 8) break;
      buffer.put(PAD1, 8);
    }
    return QRCodeModel.createBytes(buffer, rsBlocks);
  };
  QRCodeModel.createBytes = function (buffer, rsBlocks) {
    var offset = 0, maxDcCount = 0, maxEcCount = 0;
    var dcdata = new Array(rsBlocks.length), ecdata = new Array(rsBlocks.length);
    for (var r = 0; r < rsBlocks.length; r++) {
      var dcCount = rsBlocks[r].dataCount;
      var ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (var i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
      offset += dcCount;
      var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
      var modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (i = 0; i < ecdata[r].length; i++) {
        var modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = (modIndex >= 0) ? modPoly.getAt(modIndex) : 0;
      }
    }
    var totalCodeCount = 0;
    for (i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
    var data = new Array(totalCodeCount), index = 0;
    for (i = 0; i < maxDcCount; i++) {
      for (r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (i = 0; i < maxEcCount; i++) {
      for (r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  };

  // ---- public factory ----
  function qrcode(typeNumber, errorCorrectionLevel) {
    var ecl = (typeof errorCorrectionLevel === 'string')
      ? QRErrorCorrectionLevel[errorCorrectionLevel.toUpperCase()]
      : errorCorrectionLevel;
    if (ecl === undefined) ecl = QRErrorCorrectionLevel.M;

    var _model = null;
    var _typeNumber = typeNumber || 0;
    var _ecl = ecl;
    var _data = null;

    var api = {
      addData: function (data) { _data = data; _model = null; },
      make: function () {
        if (_typeNumber < 1) {
          // auto-pick the smallest version that fits the data at this EC level
          var type = 1;
          for (; type <= 40; type++) {
            var rsBlocks = QRRSBlock.getRSBlocks(type, _ecl);
            var buffer = new QRBitBuffer();
            var d = new QR8bitByte(_data);
            buffer.put(d.mode, 4);
            buffer.put(d.getLength(), QRUtil.getLengthInBits(d.mode, type));
            d.write(buffer);
            var totalDataCount = 0;
            for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
            if (buffer.getLengthInBits() <= totalDataCount * 8) break;
          }
          _typeNumber = type;
        }
        _model = new QRCodeModel(_typeNumber, _ecl);
        _model.addData(_data);
        _model.make();
      },
      getModuleCount: function () { return _model.getModuleCount(); },
      isDark: function (row, col) { return _model.isDark(row, col); },
      // Draw the QR code onto a 2D canvas context.
      // opts: { dark, light, margin } — margin is in modules (quiet zone), default 4.
      renderToCanvas: function (ctx, x, y, size, opts) {
        opts = opts || {};
        var dark = opts.dark || '#000000';
        var light = opts.light || '#ffffff';
        var margin = (opts.margin === undefined) ? 4 : opts.margin;
        var count = _model.getModuleCount();
        var total = count + margin * 2;
        var cell = size / total;
        ctx.fillStyle = light;
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = dark;
        for (var row = 0; row < count; row++) {
          for (var col = 0; col < count; col++) {
            if (_model.isDark(row, col)) {
              var px = x + (col + margin) * cell;
              var py = y + (row + margin) * cell;
              // +1 to avoid hairline gaps between modules from sub-pixel rounding
              ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(cell) + 1, Math.ceil(cell) + 1);
            }
          }
        }
      }
    };
    return api;
  }
  qrcode.ErrorCorrectionLevel = QRErrorCorrectionLevel;
  return qrcode;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = qrcode;
