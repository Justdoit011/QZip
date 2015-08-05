/*****************************************************
 * QZip v1.0
 * A JavaScript util to list all entries in Zip file.
 * Support Zip and Zip64. HTML5 browser required.
 * usage:
 * var zip = new QZip.ZipFile(file,
 *              function (entries) {
 *                  //success callback
 *                  entries[0].fileName;
 *                  entries[0].uncompressedSize;
 *                  entries[0].date;
 *              },
 *              function (err) { error callback });
 *****************************************************/
var QZip;
(function (QZip) {
    var Internal;
    (function (Internal) {
        /* Binary Reader: read binary data with a cursor
         * base class, cannot be initialized directly
         * usage: var reader = Internal.BinaryReader.CreateReader(array, offset);
         */
        var BinaryReader = (function () {
            function BinaryReader() {
            }
            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            BinaryReader.prototype.byteAt = function (i) {
                throw new Error("byteAt is not implemented.");
            };
            /**
             * Check that the offset will not go too far.
             * @param {string} offset the additional offset to check.
             * @throws {Error} an Error if the offset is out of bounds.
             */
            BinaryReader.prototype.checkOffset = function (offset) {
                this.checkIndex(this.index + offset);
            };
            /**
             * Check that the specifed index will not be too far.
             * @param {string} newIndex the index to check.
             * @throws {Error} an Error if the index is out of bounds.
             */
            BinaryReader.prototype.checkIndex = function (newIndex) {
                if (this.length < newIndex || newIndex < 0) {
                    throw new Error("End of data reached (data length = " + this.length + ", asked index = " + (newIndex) + "). Corrupted zip ?");
                }
            };
            /**
             * Change the index.
             * @param {number} newIndex The new index.
             * @param {boolean} isGlobal whether base on global offset (file beginning)
             * @throws {Error} if the new index is out of the data.
             */
            BinaryReader.prototype.setIndex = function (newIndex, isGlobal) {
                if (isGlobal)
                    newIndex -= this.offset;
                this.checkIndex(newIndex);
                this.index = newIndex;
            };
            /**
             * Skip the next n bytes.
             * @param {number} n the number of bytes to skip.
             * @throws {Error} if the new index is out of the data.
             */
            BinaryReader.prototype.skip = function (n) {
                this.setIndex(this.index + n);
            };
            /**
             * Find the last occurence of a zip signature (4 bytes).
             * @param {string} sig the signature to find.
             * @return {number} the index of the last occurence, -1 if not found.
             */
            BinaryReader.prototype.lastIndexOfSignature = function (sig, upperBound, lowerBound) {
                if (!upperBound)
                    upperBound = this.length - 4;
                else if (upperBound >= this.length)
                    upperBound = this.length - 4;
                if (!lowerBound)
                    lowerBound = 0;
                else if (lowerBound < 0)
                    lowerBound = 0;
                QZip.ZipFile.writeLog("Search signature: " + lowerBound + " to " + upperBound);
                var sig0 = sig.charCodeAt(0), sig1 = sig.charCodeAt(1), sig2 = sig.charCodeAt(2), sig3 = sig.charCodeAt(3);
                for (var i = upperBound; i >= lowerBound; --i) {
                    if (this.byteAt(i) === sig0 && this.byteAt(i + 1) === sig1 && this.byteAt(i + 2) === sig2 && this.byteAt(i + 3) === sig3) {
                        QZip.ZipFile.writeLog("Signature found in " + (upperBound - i + 1) + " try.");
                        return i;
                    }
                }
                return -1;
            };
            /**
             * Get the next number with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {number} the corresponding number.
             */
            BinaryReader.prototype.readInt = function (size) {
                throw new Error("readInt is not implemented.");
            };
            BinaryReader.prototype.readInt64 = function () {
                var lower = this.readInt(4);
                var upper = this.readInt(4);
                if (upper === 0)
                    return lower;
                return upper * 4294967296 + lower;
            };
            /**
             * Get the next string with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {string} the corresponding string.
             */
            BinaryReader.prototype.readString = function (size) {
                throw new Error("readString is not implemented.");
            };
            /**
             * Get the next date.
             * @return {Date} the date.
             */
            BinaryReader.prototype.readDate = function () {
                var dostime = this.readInt(4);
                return new Date(((dostime >> 25) & 0x7f) + 1980, ((dostime >> 21) & 0x0f) - 1, (dostime >> 16) & 0x1f, (dostime >> 11) & 0x1f, (dostime >> 5) & 0x3f, (dostime & 0x1f) << 1); // second
            };
            BinaryReader.prototype.dispose = function () { };
            /**
             * Create proper binary reader instance based on data type
             * @return {BinaryReader} the reader instance.
             */
            BinaryReader.CreateReader = function (data, offset) {
                if (data instanceof ArrayBuffer) {
                    return new Internal.Uint8ArrayReader(new Uint8Array(data), offset);
                }
                throw new Error("Unsupported binary reader type.");
            };
            BinaryReader.MAX_VALUE_32BITS = 0xFFFFFFFF;
            return BinaryReader;
        })();
        Internal.BinaryReader = BinaryReader;
    })(Internal = QZip.Internal || (QZip.Internal = {}));
})(QZip || (QZip = {}));
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="BinaryReader.ts" />
var QZip;
(function (QZip) {
    var Internal;
    (function (Internal) {
        /* Binary Reader: read Uint8Array with a cursor
         * Port from JSZip https://github.com/Stuk/jszip
         * lib/dataReader.js, lib/uint8ArrayReader.js
         * MIT license or the GPLv3
         */
        var Uint8ArrayReader = (function (_super) {
            __extends(Uint8ArrayReader, _super);
            function Uint8ArrayReader(data, offset) {
                _super.call(this);
                if (!data)
                    throw new Error("Array buffer is empty.");
                this.index = 0;
                this.length = data.length;
                this.data = data;
                if (offset && offset > 0)
                    this.offset = offset;
                else
                    this.offset = 0;
            }
            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            Uint8ArrayReader.prototype.byteAt = function (i) {
                return this.data[i];
            };
            /**
             * Get the next number with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {number} the corresponding number.
             */
            Uint8ArrayReader.prototype.readInt = function (size) {
                var result = 0, i;
                this.checkOffset(size);
                for (i = this.index + size - 1; i >= this.index; i--) {
                    result = (result << 8) + this.byteAt(i);
                }
                this.index += size;
                return result >>> 0; //convert signed int to unsigned
            };
            /**
             * Get the next string with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {string} the corresponding string.
             */
            Uint8ArrayReader.prototype.readString = function (size) {
                if (size === 0)
                    return "";
                var result = this.arrayLikeToString(this.data, this.index, this.index + size);
                this.index += size;
                return result;
            };
            /** utils.js
             * Transform an array-like object to a string.
             * @param {Uint8Array} array the array to transform.
             * @param {lowerLimit} lower bound index of this array. >=
             * @param {upperLimit} upper bound index of this array. <
             * @return {String} the result.
             */
            Uint8ArrayReader.prototype.arrayLikeToString = function (array, lowerLimit, upperLimit) {
                // Performances notes :
                // --------------------
                // String.fromCharCode.apply(null, array) is the fastest, see
                // see http://jsperf.com/converting-a-uint8array-to-a-string/2
                // but the stack is limited (and we can get huge arrays !).
                //
                // result += String.fromCharCode(array[i]); generate too many strings !
                //
                // This code is inspired by http://jsperf.com/arraybuffer-to-string-apply-performance/2
                var chunk = 65536;
                var result = [], len = upperLimit, type = "uint8array", k = lowerLimit, canUseApply = true;
                try {
                    String.fromCharCode.apply(null, new Uint8Array(0));
                }
                catch (e) {
                    canUseApply = false;
                }
                // no apply : slow and painful algorithm
                // default browser on android 4.*
                if (!canUseApply) {
                    var resultStr = "";
                    for (var i = k; i < len; i++) {
                        resultStr += String.fromCharCode(array[i]);
                    }
                    return resultStr;
                }
                while (k < len && chunk > 1) {
                    try {
                        result.push(String.fromCharCode.apply(null, array.subarray(k, Math.min(k + chunk, len))));
                        k += chunk;
                    }
                    catch (e) {
                        chunk = Math.floor(chunk / 2);
                    }
                }
                return result.join("");
            };
            Uint8ArrayReader.prototype.dispose = function () {
                if (this.data)
                    this.data = null;
            };
            return Uint8ArrayReader;
        })(Internal.BinaryReader);
        Internal.Uint8ArrayReader = Uint8ArrayReader;
    })(Internal = QZip.Internal || (QZip.Internal = {}));
})(QZip || (QZip = {}));
/// <reference path="BinaryReader.ts" />
var QZip;
(function (QZip) {
    var Internal;
    (function (Internal) {
        /* ZipEntry: parse and read a entry from zip file
         * Dependence: BinaryReader
         *
         */
        var ZipEntry = (function () {
            function ZipEntry(reader, zip64) {
                this.zip64 = false;
                this.isDir = false;
                this.zip64 = zip64;
                this.readCentralPart(reader);
            }
            ZipEntry.prototype.readCentralPart = function (reader) {
                reader.skip(2 + 2);
                this.bitFlag = reader.readInt(2);
                reader.skip(2);
                this.date = reader.readDate();
                reader.skip(4 + 4);
                this.uncompressedSize = reader.readInt(4);
                var fileNameLength = reader.readInt(2);
                var extraFieldsLength = reader.readInt(2);
                var fileCommentLength = reader.readInt(2);
                reader.skip(2 + 2 + 4 + 4);
                if (this.isEncrypted()) {
                    throw new Error("Encrypted zip are not supported");
                }
                this.fileName = reader.readString(fileNameLength);
                if (this.useUTF8())
                    this.fileName = this.decodeUTF8(this.fileName);
                else
                    this.fileName = this.decodeASCII(this.fileName);
                if (this.fileName.charAt(this.fileName.length - 1) == '/')
                    this.isDir = true;
                if (this.uncompressedSize === Internal.BinaryReader.MAX_VALUE_32BITS)
                    this.parseZIP64ExtraField(reader, extraFieldsLength);
                else
                    reader.skip(extraFieldsLength);
                reader.skip(fileCommentLength);
            };
            /**
             * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
             * @param {DataReader} reader the reader to use.
             */
            ZipEntry.prototype.parseZIP64ExtraField = function (reader, extraFieldsLength) {
                //locate extra fields containing zip64 info
                var start = 0;
                var end = extraFieldsLength;
                while (start < end) {
                    var extraFieldId = reader.readInt(2);
                    var extraFieldLength = reader.readInt(2);
                    start += 4 + extraFieldLength;
                    //zip64 field id
                    if (extraFieldId != 0x0001) {
                        reader.skip(extraFieldLength);
                        continue;
                    }
                    //found zip64 field
                    this.uncompressedSize = reader.readInt64();
                    reader.skip(extraFieldLength - 8);
                    this.zip64 = true;
                    break;
                }
                reader.skip(end - start);
            };
            /**
             * say if the file is encrypted.
             * @return {boolean} true if the file is encrypted, false otherwise.
             */
            ZipEntry.prototype.isEncrypted = function () {
                // bit 1 is set
                return (this.bitFlag & 0x0001) === 0x0001;
            };
            /**
             * say if the file has utf-8 filename/comment.
             * @return {boolean} true if the filename/comment is in utf-8, false otherwise.
             */
            ZipEntry.prototype.useUTF8 = function () {
                // bit 11 is set
                return (this.bitFlag & 0x0800) === 0x0800;
            };
            /*******************************************************************************************
             * Ref: http://ecmanaut.blogspot.com/2006/07/encoding-decoding-utf8-in-javascript.html
             *      http://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
             * originally in zip.js
             *******************************************************************************************/
            ZipEntry.prototype.decodeUTF8 = function (str) {
                try {
                    return decodeURIComponent(escape(str));
                }
                catch (e) {
                    return str;
                }
            };
            ZipEntry.prototype.decodeASCII = function (str) {
                var i, out = "", charCode, extendedASCII = ['\u00C7', '\u00FC', '\u00E9', '\u00E2', '\u00E4', '\u00E0', '\u00E5', '\u00E7', '\u00EA', '\u00EB',
                    '\u00E8', '\u00EF', '\u00EE', '\u00EC', '\u00C4', '\u00C5', '\u00C9', '\u00E6', '\u00C6', '\u00F4', '\u00F6', '\u00F2', '\u00FB', '\u00F9',
                    '\u00FF', '\u00D6', '\u00DC', '\u00F8', '\u00A3', '\u00D8', '\u00D7', '\u0192', '\u00E1', '\u00ED', '\u00F3', '\u00FA', '\u00F1', '\u00D1',
                    '\u00AA', '\u00BA', '\u00BF', '\u00AE', '\u00AC', '\u00BD', '\u00BC', '\u00A1', '\u00AB', '\u00BB', '_', '_', '_', '\u00A6', '\u00A6',
                    '\u00C1', '\u00C2', '\u00C0', '\u00A9', '\u00A6', '\u00A6', '+', '+', '\u00A2', '\u00A5', '+', '+', '-', '-', '+', '-', '+', '\u00E3',
                    '\u00C3', '+', '+', '-', '-', '\u00A6', '-', '+', '\u00A4', '\u00F0', '\u00D0', '\u00CA', '\u00CB', '\u00C8', 'i', '\u00CD', '\u00CE',
                    '\u00CF', '+', '+', '_', '_', '\u00A6', '\u00CC', '_', '\u00D3', '\u00DF', '\u00D4', '\u00D2', '\u00F5', '\u00D5', '\u00B5', '\u00FE',
                    '\u00DE', '\u00DA', '\u00DB', '\u00D9', '\u00FD', '\u00DD', '\u00AF', '\u00B4', '\u00AD', '\u00B1', '_', '\u00BE', '\u00B6', '\u00A7',
                    '\u00F7', '\u00B8', '\u00B0', '\u00A8', '\u00B7', '\u00B9', '\u00B3', '\u00B2', '_', ' '];
                for (i = 0; i < str.length; i++) {
                    charCode = str.charCodeAt(i) & 0xFF;
                    if (charCode > 127)
                        out += extendedASCII[charCode - 128];
                    else
                        out += String.fromCharCode(charCode);
                }
                return out;
            };
            return ZipEntry;
        })();
        Internal.ZipEntry = ZipEntry;
    })(Internal = QZip.Internal || (QZip.Internal = {}));
})(QZip || (QZip = {}));
/// <reference path="ZipEntry.ts" />
var QZip;
(function (QZip) {
    /* ZipFile class: the only external class, main entrance of QZip
     *   parse and read zip file
     */
    var ZipFile = (function () {
        function ZipFile(file, onload, onerror) {
            this.zip64 = false;
            this.files = [];
            this.onerror = function (e) { alert(e); console.log(e); };
            if (typeof (onerror) == "function")
                this.onerror = onerror;
            try {
                if (file === undefined || file === null)
                    throw new Error("Zip file is required.");
                if (file.size <= ZipFile.EOCDR_MIN)
                    throw new Error("Invalid zip file: " + file.name);
                this.file = file;
                this.name = file.name;
                this.size = file.size;
                this.onload = onload;
                ZipFile.writeLog("Begin reading zip file: " + this.name);
                this.SeekEndOfCentral();
            }
            catch (e) {
                this.onerror(e);
            }
        }
        ZipFile.prototype.SeekEndOfCentral = function () {
            //read partial file into memory buffer
            var reader = this.createReader();
            var start = this.file.size - ZipFile.EOCDR_BUF;
            if (start < 0)
                start = 0;
            var self = this;
            ZipFile.writeLog("Seek start: " + start);
            reader.onload = function () {
                try {
                    if (self.CheckEndOfCentral(reader.result, start))
                        return;
                    self.onerror(ZipFile.ERR_BAD_FORMAT + "End of Central Directory not found.");
                }
                catch (e) {
                    self.onerror(e);
                }
            };
            reader.onerror = function (error) {
                self.onerror(ZipFile.ERR_READ + "EOCDR I/O Error " + error);
            };
            this.openReader(reader, this.file.slice(start));
        };
        ZipFile.prototype.SeekCentral = function () {
            var reader = this.createReader();
            var start = this.centralDirOffset;
            if (this.file.size - start > ZipFile.CDR_MAX)
                throw new Error("There are too many entries in zip file than supported. Please reduce your zip file size.");
            var self = this;
            ZipFile.writeLog("Seek start: " + start);
            reader.onload = function () {
                try {
                    self.readCentralDir(reader.result, start);
                }
                catch (e) {
                    self.onerror(e);
                }
            };
            reader.onerror = function (error) {
                self.onerror(ZipFile.ERR_READ + "CDR I/O Error " + error);
            };
            this.openReader(reader, this.file.slice(start));
        };
        //Try to find EOCDR in the buffer. Return false if not found
        ZipFile.prototype.CheckEndOfCentral = function (array, start) {
            this.reader = QZip.Internal.BinaryReader.CreateReader(array, start);
            var offset = this.reader.lastIndexOfSignature(ZipFile.CENTRAL_DIRECTORY_END, this.reader.length - ZipFile.EOCDR_MIN, this.reader.length - ZipFile.EOCDR_MAX);
            if (offset === -1)
                return false;
            //EOCDR found, try to parse it
            ZipFile.writeLog("EOCDR found: " + offset);
            this.reader.setIndex(offset);
            this.checkSignature(ZipFile.CENTRAL_DIRECTORY_END);
            this.readBlockEndOfCentral();
            /* extract from the zip spec :
                4)  If one of the fields in the end of central directory
                    record is too small to hold required data, the field
                    should be set to -1 (0xFFFF or 0xFFFFFFFF) and the
                    ZIP64 format record should be created.
                5)  The end of central directory record and the
                    Zip64 end of central directory locator record must
                    reside on the same disk when splitting or spanning
                    an archive.
             */
            if (this.centralDirOffset === QZip.Internal.BinaryReader.MAX_VALUE_32BITS) {
                this.zip64 = true;
                ZipFile.writeLog("Zip64 detected.");
                /*
                Warning : the zip64 extension is supported, but ONLY if the 64bits integer read from
                the zip file can fit into a 32bits integer. This cannot be solved : Javascript represents
                all numbers as 64-bit double precision IEEE 754 floating point numbers.
                So, we have 53bits for integers and bitwise operations treat everything as 32bits.
                see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/Bitwise_Operators
                and http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf section 8.5
                */
                // should look for a zip64 EOCD locator
                offset = this.reader.lastIndexOfSignature(ZipFile.ZIP64_CENTRAL_DIRECTORY_LOCATOR, offset);
                if (offset === -1) {
                    throw new Error("Corrupted zip : can't find the ZIP64 end of central directory locator");
                }
                this.reader.setIndex(offset);
                ZipFile.writeLog("EOCDR zip64 end found: " + offset);
                this.checkSignature(ZipFile.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
                offset = this.readBlockZip64EndOfCentralLocator();
                // now the zip64 EOCD record
                this.reader.setIndex(offset, true);
                this.checkSignature(ZipFile.ZIP64_CENTRAL_DIRECTORY_END);
                this.readBlockZip64EndOfCentral();
            }
            //seek the file for central directory based on centralDirOffset
            this.SeekCentral();
            return true;
        };
        /**
         * Read the end of the central directory.
         */
        ZipFile.prototype.readBlockEndOfCentral = function () {
            this.reader.skip(2 + 2 + 2 + 2 + 4);
            this.centralDirOffset = this.reader.readInt(4);
            ZipFile.writeLog("Central Dir offset: " + this.centralDirOffset);
        };
        /**
         * Read the end of the Zip 64 central directory.
         * Not merged with the method readEndOfCentral :
         * The end of central can coexist with its Zip64 brother,
         * I don't want to read the wrong number of bytes !
         */
        ZipFile.prototype.readBlockZip64EndOfCentral = function () {
            this.reader.skip(8 + 2 + 2 + 4 + 4 + 8 + 8 + 8);
            this.centralDirOffset = this.reader.readInt64();
            ZipFile.writeLog("Central Dir offset zip64: " + this.centralDirOffset);
        };
        /**
         * Read the end of the Zip 64 central directory locator.
         */
        ZipFile.prototype.readBlockZip64EndOfCentralLocator = function () {
            var diskWithZip64CentralDirStart = this.reader.readInt(4);
            var relativeOffsetEndOfZip64CentralDir = this.reader.readInt64();
            var disksCount = this.reader.readInt(4);
            if (disksCount > 1) {
                throw new Error("Multi-volumes zip are not supported.");
            }
            ZipFile.writeLog("EOCDR zip64 found: " + relativeOffsetEndOfZip64CentralDir);
            return relativeOffsetEndOfZip64CentralDir;
        };
        /**
         * Read the central directory.
         */
        ZipFile.prototype.readCentralDir = function (array, start) {
            if (this.reader)
                this.reader.dispose();
            this.reader = QZip.Internal.BinaryReader.CreateReader(array, start);
            ZipFile.writeLog("Read central dir.");
            while (this.reader.readString(4) === ZipFile.CENTRAL_FILE_HEADER) {
                var file = new QZip.Internal.ZipEntry(this.reader, this.zip64);
                if (!file.isDir)
                    this.files.push(file);
            }
            if (typeof (this.onload) != "function")
                return;
            this.onload(this.files);
        };
        /**
         * Check that the reader is on the speficied signature.
         * @param {string} expectedSignature the expected signature.
         * @throws {Error} if it is an other signature.
         */
        ZipFile.prototype.checkSignature = function (expectedSignature) {
            var signature = this.reader.readString(4);
            if (signature !== expectedSignature) {
                throw new Error("Corrupted zip or bug : unexpected signature " + "(" + signature + ", expected " + expectedSignature + ")");
            }
        };
        /**
         * Create file reader based on browser capacity
         */
        ZipFile.prototype.createReader = function () {
            if (typeof (FileReader) === "function")
                return new FileReader();
            else
                throw new Error("Your browser does not have FileReader.");
        };
        /**
         * Open file reader based on browser capacity
         */
        ZipFile.prototype.openReader = function (reader, file) {
            if (typeof (reader.readAsArrayBuffer) === "function") {
                if (typeof (file.getSource) === "function")
                    file = file.getSource(); //convert moxie file to original html5 file
                reader.readAsArrayBuffer(file);
            }
            else
                throw new Error("Your browser does not support reading binary file.");
        };
        //Print log if debug flag is true
        ZipFile.writeLog = function (msg) {
            if (!ZipFile.DEBUG)
                return;
            console.log(msg);
        };
        ZipFile.EOCDR_MIN = 22; //22 Byte
        ZipFile.EOCDR_MAX = 65558; //64 KB comment max + 22 B EOCDR
        ZipFile.EOCDR_BUF = 66560; //65 KB as buffer, which can cover all EOCDR records including zip64
        ZipFile.CDR_MAX = 0xFFFFFFF; //256 MB is the max size limit of central directory
        ZipFile.ERR_BAD_FORMAT = "Zip file format is not recognized. ";
        ZipFile.ERR_READ = "Error while reading zip file. ";
        ZipFile.DEBUG = true;
        //signatures
        ZipFile.CENTRAL_FILE_HEADER = "PK\x01\x02";
        ZipFile.CENTRAL_DIRECTORY_END = "PK\x05\x06";
        ZipFile.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x06\x07";
        ZipFile.ZIP64_CENTRAL_DIRECTORY_END = "PK\x06\x06";
        return ZipFile;
    })();
    QZip.ZipFile = ZipFile;
})(QZip || (QZip = {}));
//# sourceMappingURL=Zip.js.map