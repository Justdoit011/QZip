/// <reference path="BinaryReader.ts" />
module QZip {

    export module Internal {
        /* Binary Reader: read Uint8Array with a cursor
         * Port from JSZip https://github.com/Stuk/jszip
         * lib/dataReader.js, lib/uint8ArrayReader.js
         * MIT license or the GPLv3
         */
        export class Uint8ArrayReader extends BinaryReader {
            private data: Uint8Array;   //data buffer

            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            protected byteAt(i: number): number {
                return this.data[i];
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

            constructor(data: Uint8Array, offset?: number) {
                super();
                if (!data) throw new Error("Array buffer is empty.");
                this.index = 0;
                this.length = data.length;
                this.data = data;
                if (offset && offset > 0) this.offset = offset;
                else this.offset = 0;
            }
        }
    }
}