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
        /* Binary Reader: read binary data with a cursor
         * base class, cannot be initialized directly
         * usage: var reader = Internal.BinaryReader.CreateReader(array, offset);
         */
        export class BinaryReader {
            length: number;             //length of data buffer
            protected index: number;    //current index
            protected offset: number;   //global offset, the data buffer begins at which byte on the whole file
            

            static MAX_VALUE_32BITS: number = 0xFFFFFFFF;

            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            protected byteAt(i: number): number {
                throw new Error("byteAt is not implemented.");
            }

            /**
             * Check that the offset will not go too far.
             * @param {string} offset the additional offset to check.
             * @throws {Error} an Error if the offset is out of bounds.
             */
            protected checkOffset(offset: number): void {
                this.checkIndex(this.index + offset);
            }

            /**
             * Check that the specifed index will not be too far.
             * @param {string} newIndex the index to check.
             * @throws {Error} an Error if the index is out of bounds.
             */
            protected checkIndex(newIndex: number): void {
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
                    if (this.byteAt(i) === sig0 && this.byteAt(i + 1) === sig1 && this.byteAt(i + 2) === sig2 && this.byteAt(i + 3) === sig3) {
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
                throw new Error("readInt is not implemented.");
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
                throw new Error("readString is not implemented.");
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

            constructor() { }

            dispose(): void { }

            /**
             * Create proper binary reader instance based on data type
             * @return {BinaryReader} the reader instance.
             */
            static CreateReader(data: any, offset: number) {
                if (typeof (ArrayBuffer) === "function" && data instanceof ArrayBuffer) {
                    return new Uint8ArrayReader(new Uint8Array(data), offset);
                }

                throw new Error("Unsupported binary reader data type: " + typeof (data));
            }
        }
    }
}