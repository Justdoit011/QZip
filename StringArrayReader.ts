/// <reference path="BinaryReader.ts" />
module QZip {

    export module Internal {
        /* String Array Reader: read a string array with a cursor
         *   Each char of the string is considered as a byte
         */
        export class StringArrayReader extends BinaryReader {
            private data: string;   //data buffer

            /**
             * Get the byte at the specified index.
             * @param {number} i the index to use.
             * @return {number} a byte.
             */
            protected byteAt(i: number): number {
                return this.data.charCodeAt(i);
            }

            /**
             * Get the next string with a given byte size.
             * @param {number} size the number of bytes to read.
             * @return {string} the corresponding string.
             */
            readString(size: number): string {
                if (size === 0) return "";

                var result = this.data.substring(this.index, this.index + size);
                this.index += size;
                return result;
            }

            dispose(): void {
                if (this.data) this.data = null;
            }

            /**
             * Initialize a String Array Reader
             * @param {data} data array that contains bytes.
             * @param {offset} global offset, at which byte on original file this data array started
             */
            constructor(data: string, offset?: number) {
                if (!data) throw new Error("Array buffer is empty.");
                this.data = data;
                super(data.length, offset);
            }
        }
    }
}