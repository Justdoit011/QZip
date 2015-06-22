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
module QZip {

    export module Internal {
        /* Binary Reader: read Uint8Array with a cursor
         * Port from JSZip https://github.com/Stuk/jszip
         * lib/dataReader.js, lib/uint8ArrayReader.js
         * MIT license or the GPLv3
         */
        export class BinaryReader {
            length: number;             //length of data buffer
            private index: number;      //current index
            private offset: number;     //global offset, the data buffer begins at which byte on the whole file
            private data: Uint8Array;   //data buffer

            static MAX_VALUE_32BITS: number = 0xFFFFFFFF;

            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            private byteAt(i: number): number {
                return this.data[i];
            }

            /**
             * Check that the offset will not go too far.
             * @param {string} offset the additional offset to check.
             * @throws {Error} an Error if the offset is out of bounds.
             */
            private checkOffset(offset: number): void {
                this.checkIndex(this.index + offset);
            }

            /**
             * Check that the specifed index will not be too far.
             * @param {string} newIndex the index to check.
             * @throws {Error} an Error if the index is out of bounds.
             */
            private checkIndex(newIndex: number): void {
                if (this.length < newIndex || newIndex < 0) {
                    throw new Error("End of data reached (data length = " + this.length + ", asked index = " + (newIndex) + "). Corrupted zip ?");
                }
            }

            /**
             * Change the index.
             * @param {number} newIndex The new index.
             * @param {boolean} isGlobal whether base on global offset (file beginning)
             * @throws {Error} if the new index is out of the data.
             */
            setIndex(newIndex: number, isGlobal?: boolean): void {
                if (isGlobal) newIndex -= this.offset;

                this.checkIndex(newIndex);
                this.index = newIndex;
            }

            /**
             * Skip the next n bytes.
             * @param {number} n the number of bytes to skip.
             * @throws {Error} if the new index is out of the data.
             */
            skip(n: number): void {
                this.setIndex(this.index + n);
            }

            /**
             * Find the last occurence of a zip signature (4 bytes).
             * @param {string} sig the signature to find.
             * @return {number} the index of the last occurence, -1 if not found.
             */
            lastIndexOfSignature(sig: string, upperBound?: number, lowerBound?: number): number {
                if (!upperBound) upperBound = this.length - 4;
                else if (upperBound >= this.length) upperBound = this.length - 4;

                if (!lowerBound) lowerBound = 0;
                else if (lowerBound < 0) lowerBound = 0;
                ZipFile.writeLog("Search signature: " + lowerBound + " to " + upperBound);

                var sig0 = sig.charCodeAt(0),
                    sig1 = sig.charCodeAt(1),
                    sig2 = sig.charCodeAt(2),
                    sig3 = sig.charCodeAt(3);
                for (var i = upperBound; i >= lowerBound; --i) {
                    if (this.data[i] === sig0 && this.data[i + 1] === sig1 && this.data[i + 2] === sig2 && this.data[i + 3] === sig3) {
                        ZipFile.writeLog("Signature found in " + (upperBound - i + 1) + " try.");
                        return i;
                    }
                }

                return -1;
            }

            /**
             * Get the next number with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {number} the corresponding number.
             */
            readInt(size: number): number {
                var result = 0,
                    i;
                this.checkOffset(size);
                for (i = this.index + size - 1; i >= this.index; i--) {
                    result = (result << 8) + this.byteAt(i);
                }
                this.index += size;
                return result >>> 0;    //convert signed int to unsigned
            }

            readInt64(): number {
                var lower = this.readInt(4);
                var upper = this.readInt(4);
                if (upper === 0) return lower;

                return upper * 4294967296 + lower;
            }

            /**
             * Get the next string with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {string} the corresponding string.
             */
            readString(size: number): string {
                if (size === 0) return "";

                var result = this.arrayLikeToString(this.data, this.index, this.index + size);
                this.index += size;
                return result;
            }

            /**
             * Get the next date.
             * @return {Date} the date.
             */
            readDate(): Date {
                var dostime = this.readInt(4);
                return new Date(
                    ((dostime >> 25) & 0x7f) + 1980, // year
                    ((dostime >> 21) & 0x0f) - 1, // month
                    (dostime >> 16) & 0x1f, // day
                    (dostime >> 11) & 0x1f, // hour
                    (dostime >> 5) & 0x3f, // minute
                    (dostime & 0x1f) << 1); // second
            }

            constructor(data: Uint8Array, offset?: number) {
                if (!data) throw new Error("Array buffer is empty.");
                this.index = 0;
                this.length = data.length;
                this.data = data;
                if (offset && offset > 0) this.offset = offset;
                else this.offset = 0;
            }

            /** utils.js
             * Transform an array-like object to a string.
             * @param {Uint8Array} array the array to transform.
             * @param {lowerLimit} lower bound index of this array. >=
             * @param {upperLimit} upper bound index of this array. <
             * @return {String} the result.
             */
            private arrayLikeToString(array: Uint8Array, lowerLimit: number, upperLimit: number): string {
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
                var result = [],
                    len = upperLimit,
                    type = "uint8array",
                    k = lowerLimit,
                    canUseApply = true;
                try {
                    String.fromCharCode.apply(null, new Uint8Array(0));
                } catch (e) {
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
            }

            dispose(): void {
                if (this.data) this.data = null;
            }
        }
    }
}