/// <reference path="BinaryReader.ts" />

module QZip {

    export module Internal {
        export class ZipEntry {
            zip64: boolean = false;
            date: Date;
            uncompressedSize: number;
            fileName: string;
            isDir: boolean = false;

            private bitFlag: number;

            readCentralPart(reader: BinaryReader): void {
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
                if (this.useUTF8()) this.fileName = this.decodeUTF8(this.fileName);
                else this.fileName = this.decodeASCII(this.fileName);
                if (this.fileName.charAt(this.fileName.length - 1) == '/') this.isDir = true;

                if (this.uncompressedSize === BinaryReader.MAX_VALUE_32BITS) this.parseZIP64ExtraField(reader, extraFieldsLength);
                else reader.skip(extraFieldsLength);

                reader.skip(fileCommentLength);
            }

            /**
             * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
             * @param {DataReader} reader the reader to use.
             */
            private parseZIP64ExtraField(reader: BinaryReader, extraFieldsLength: number): void {
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
            }

            /**
             * say if the file is encrypted.
             * @return {boolean} true if the file is encrypted, false otherwise.
             */
            private isEncrypted(): boolean {
                // bit 1 is set
                return (this.bitFlag & 0x0001) === 0x0001;
            }

            /**
             * say if the file has utf-8 filename/comment.
             * @return {boolean} true if the filename/comment is in utf-8, false otherwise.
             */
            private useUTF8(): boolean {
                // bit 11 is set
                return (this.bitFlag & 0x0800) === 0x0800;
            }

            constructor(reader: BinaryReader, zip64: boolean) {
                this.zip64 = zip64;
                this.readCentralPart(reader);
            }

            /*******************************************************************************************
             * Ref: http://ecmanaut.blogspot.com/2006/07/encoding-decoding-utf8-in-javascript.html
             *      http://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
             * originally in zip.js
             *******************************************************************************************/
            private decodeUTF8(str: string): string {
                try {
                    return decodeURIComponent(escape(str));
                }
                catch (e) {
                    return str;
                }
            }

            private decodeASCII(str: string): string {
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
            }
        }

        declare var escape: Function;
    }
}