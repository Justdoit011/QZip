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
declare module QZip {
    module Internal {
        class BinaryReader {
            length: number;
            protected index: number;
            protected offset: number;
            static MAX_VALUE_32BITS: number;
            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            protected byteAt(i: number): number;
            /**
             * Check that the offset will not go too far.
             * @param {string} offset the additional offset to check.
             * @throws {Error} an Error if the offset is out of bounds.
             */
            protected checkOffset(offset: number): void;
            /**
             * Check that the specifed index will not be too far.
             * @param {string} newIndex the index to check.
             * @throws {Error} an Error if the index is out of bounds.
             */
            protected checkIndex(newIndex: number): void;
            /**
             * Change the index.
             * @param {number} newIndex The new index.
             * @param {boolean} isGlobal whether base on global offset (file beginning)
             * @throws {Error} if the new index is out of the data.
             */
            setIndex(newIndex: number, isGlobal?: boolean): void;
            /**
             * Skip the next n bytes.
             * @param {number} n the number of bytes to skip.
             * @throws {Error} if the new index is out of the data.
             */
            skip(n: number): void;
            /**
             * Find the last occurence of a zip signature (4 bytes).
             * @param {string} sig the signature to find.
             * @return {number} the index of the last occurence, -1 if not found.
             */
            lastIndexOfSignature(sig: string, upperBound?: number, lowerBound?: number): number;
            /**
             * Get the next number with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {number} the corresponding number.
             */
            readInt(size: number): number;
            readInt64(): number;
            /**
             * Get the next string with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {string} the corresponding string.
             */
            readString(size: number): string;
            /**
             * Get the next date.
             * @return {Date} the date.
             */
            readDate(): Date;
            /**
             * This constructor should be only called in child classes
             *   Initialize index and offset of binary reader
             * @param {length} how many bytes of the data buffer
             * @param {offset} global offset, at which byte on original file this data array started
             */
            constructor(length: number, offset?: number);
            dispose(): void;
            /**
             * Create proper binary reader instance based on data type
             * @return {BinaryReader} the reader instance.
             */
            static CreateReader(data: any, offset: number): BinaryReader;
        }
    }
}
declare module QZip {
    module Internal {
        class StringArrayReader extends BinaryReader {
            private data;
            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            protected byteAt(i: number): number;
            /**
             * Get the next string with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {string} the corresponding string.
             */
            readString(size: number): string;
            dispose(): void;
            /**
             * Initialize a String Array Reader
             * @param {data} data array that contains bytes.
             * @param {offset} global offset, at which byte on original file this data array started
             */
            constructor(data: string, offset?: number);
        }
    }
}
declare module QZip {
    module Internal {
        class Uint8ArrayReader extends BinaryReader {
            private data;
            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            protected byteAt(i: number): number;
            /**
             * Get the next string with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {string} the corresponding string.
             */
            readString(size: number): string;
            /** utils.js
             * Transform an array-like object to a string.
             * @param {Uint8Array} array the array to transform.
             * @param {lowerLimit} lower bound index of this array. >=
             * @param {upperLimit} upper bound index of this array. <
             * @return {String} the result.
             */
            private arrayLikeToString(array, lowerLimit, upperLimit);
            dispose(): void;
            /**
             * Initialize an Uint8Array reader. HTML5 only
             * @param {data} data array that contains bytes.
             * @param {offset} global offset, at which byte on original file this data array started
             */
            constructor(data: Uint8Array, offset?: number);
        }
    }
}
declare module QZip {
    module Internal {
        class ZipEntry {
            zip64: boolean;
            date: Date;
            uncompressedSize: number;
            fileName: string;
            isDir: boolean;
            private bitFlag;
            readCentralPart(reader: BinaryReader): void;
            /**
             * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
             * @param {DataReader} reader the reader to use.
             */
            private parseZIP64ExtraField(reader, extraFieldsLength);
            /**
             * say if the file is encrypted.
             * @return {boolean} true if the file is encrypted, false otherwise.
             */
            private isEncrypted();
            /**
             * say if the file has utf-8 filename/comment.
             * @return {boolean} true if the filename/comment is in utf-8, false otherwise.
             */
            private useUTF8();
            constructor(reader: BinaryReader, zip64: boolean);
            /*******************************************************************************************
             * Ref: http://ecmanaut.blogspot.com/2006/07/encoding-decoding-utf8-in-javascript.html
             *      http://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
             * originally in zip.js
             *******************************************************************************************/
            private decodeUTF8(str);
            private decodeASCII(str);
        }
    }
}
declare module QZip {
    class ZipFile {
        static EOCDR_MIN: number;
        static EOCDR_MAX: number;
        static EOCDR_BUF: number;
        static CDR_MAX: number;
        static ERR_BAD_FORMAT: string;
        static ERR_READ: string;
        static DEBUG: boolean;
        static CENTRAL_FILE_HEADER: string;
        static CENTRAL_DIRECTORY_END: string;
        static ZIP64_CENTRAL_DIRECTORY_LOCATOR: string;
        static ZIP64_CENTRAL_DIRECTORY_END: string;
        private file;
        private reader;
        centralDirOffset: number;
        zip64: boolean;
        name: string;
        size: number;
        uncompressedSize: number;
        files: Array<Internal.ZipEntry>;
        onload: Function;
        onerror: Function;
        private SeekEndOfCentral();
        private SeekCentral();
        private CheckEndOfCentral(array, start);
        /**
         * Read the end of the central directory.
         */
        private readBlockEndOfCentral();
        /**
         * Read the end of the Zip 64 central directory.
         * Not merged with the method readEndOfCentral :
         * The end of central can coexist with its Zip64 brother,
         * I don't want to read the wrong number of bytes !
         */
        private readBlockZip64EndOfCentral();
        /**
         * Read the end of the Zip 64 central directory locator.
         */
        private readBlockZip64EndOfCentralLocator();
        /**
         * Read the central directory.
         */
        private readCentralDir(array, start);
        /**
         * Check that the reader is on the speficied signature.
         * @param {string} expectedSignature the expected signature.
         * @throws {Error} if it is an other signature.
         */
        private checkSignature(expectedSignature);
        /**
         * Create file reader based on browser capacity
         */
        private createReader();
        /**
         * Open file reader based on browser capacity
         */
        private openReader(reader, file);
        constructor(file: File, onload: Function, onerror: Function);
        static writeLog(msg: string): void;
    }
}
declare var mOxie: any;
