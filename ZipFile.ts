/// <reference path="ZipEntry.ts" />

module QZip {

    /* ZipFile class: the only external class, main entrance of QZip
     *   parse and read zip file
     */
    export class ZipFile {
        static EOCDR_MIN: number = 22;      //22 Byte
        static EOCDR_MAX: number = 65558;   //64 KB comment max + 22 B EOCDR
        static EOCDR_BUF: number = 66560;   //65 KB as buffer, which can cover all EOCDR records including zip64
        static CDR_MAX: number = 0xFFFFFFF; //256 MB is the max size limit of central directory
        static ERR_BAD_FORMAT: string = "Zip file format is not recognized. ";
        static ERR_READ: string = "Error while reading zip file. ";
        static DEBUG: boolean = true;

        //signatures
        static CENTRAL_FILE_HEADER = "PK\x01\x02";
        static CENTRAL_DIRECTORY_END = "PK\x05\x06";
        static ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x06\x07";
        static ZIP64_CENTRAL_DIRECTORY_END = "PK\x06\x06";

        //private variables
        private file: File;             //zip file reference
        private reader: Internal.BinaryReader;   //binary reader based on buffer

        //public variables
        centralDirOffset: number;
        zip64: boolean = false;
        name: string;
        size: number;
        files: Array<Internal.ZipEntry> = [];
        onload: Function;
        onerror: Function = function (e) { alert(e); console.log(e); };

        private SeekEndOfCentral(): void {
            //read partial file into memory buffer
            var reader = this.createReader();

            var start: number = this.file.size - ZipFile.EOCDR_BUF;
            if (start < 0) start = 0;
            var self = this;

            ZipFile.writeLog("Seek start: " + start);

            reader.onload = function () {
                try {
                    if (self.CheckEndOfCentral(reader.result, start)) return;
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
        }

        private SeekCentral(): void {
            var reader = this.createReader();

            var start: number = this.centralDirOffset;
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
        }

        //Try to find EOCDR in the buffer. Return false if not found
        private CheckEndOfCentral(array: any, start: number): boolean {
            this.reader = Internal.BinaryReader.CreateReader(array, start);
            var offset = this.reader.lastIndexOfSignature(ZipFile.CENTRAL_DIRECTORY_END, this.reader.length - ZipFile.EOCDR_MIN, this.reader.length - ZipFile.EOCDR_MAX);
            if (offset === -1) return false;

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
            if (this.centralDirOffset === Internal.BinaryReader.MAX_VALUE_32BITS) {
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
        }

        /**
         * Read the end of the central directory.
         */
        private readBlockEndOfCentral(): void {
            this.reader.skip(2 + 2 + 2 + 2 + 4);
            this.centralDirOffset = this.reader.readInt(4);
            ZipFile.writeLog("Central Dir offset: " + this.centralDirOffset);
        }

        /**
         * Read the end of the Zip 64 central directory.
         * Not merged with the method readEndOfCentral :
         * The end of central can coexist with its Zip64 brother,
         * I don't want to read the wrong number of bytes !
         */
        private readBlockZip64EndOfCentral(): void {
            this.reader.skip(8 + 2 + 2 + 4 + 4 + 8 + 8 + 8);
            this.centralDirOffset = this.reader.readInt64();
            ZipFile.writeLog("Central Dir offset zip64: " + this.centralDirOffset);
        }

        /**
         * Read the end of the Zip 64 central directory locator.
         */
        private readBlockZip64EndOfCentralLocator(): number {
            var diskWithZip64CentralDirStart = this.reader.readInt(4);
            var relativeOffsetEndOfZip64CentralDir = this.reader.readInt64();
            var disksCount = this.reader.readInt(4);
            if (disksCount > 1) {
                throw new Error("Multi-volumes zip are not supported.");
            }

            ZipFile.writeLog("EOCDR zip64 found: " + relativeOffsetEndOfZip64CentralDir);
            return relativeOffsetEndOfZip64CentralDir;
        }

        /**
         * Read the central directory.
         */
        private readCentralDir(array: any, start: number): void {
            if (this.reader) this.reader.dispose();
            this.reader = Internal.BinaryReader.CreateReader(array, start);

            ZipFile.writeLog("Read central dir.");
            while (this.reader.readString(4) === ZipFile.CENTRAL_FILE_HEADER) {
                var file = new Internal.ZipEntry(this.reader, this.zip64);
                if (!file.isDir) this.files.push(file);
            }

            if (typeof (this.onload) != "function") return;
            this.onload(this.files);
        }

        /**
         * Check that the reader is on the speficied signature.
         * @param {string} expectedSignature the expected signature.
         * @throws {Error} if it is an other signature.
         */
        private checkSignature(expectedSignature: string) {
            var signature = this.reader.readString(4);
            if (signature !== expectedSignature) {
                throw new Error("Corrupted zip or bug : unexpected signature " + "(" + signature + ", expected " + expectedSignature + ")");
            }
        }

        /**
         * Create file reader based on browser capacity
         */
        private createReader(): any {
            if (typeof (FileReader) === "function") return new FileReader();
            else throw new Error("Your browser does not have FileReader.");
        }

        /**
         * Open file reader based on browser capacity
         */
        private openReader(reader: any, file: any) {
            if (typeof (reader.readAsArrayBuffer) === "function") {
                if (typeof (file.getSource) === "function") file = file.getSource();    //convert moxie file to original html5 file
                reader.readAsArrayBuffer(file);
            }
            else throw new Error("Your browser does not support reading binary file.");
        }

        constructor(file: File, onload: Function, onerror: Function) {
            if (typeof (onerror) == "function") this.onerror = onerror;

            try {
                if (file === undefined || file === null) throw new Error("Zip file is required.");
                if (file.size <= ZipFile.EOCDR_MIN) throw new Error("Invalid zip file: " + file.name);
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

        //Print log if debug flag is true
        static writeLog(msg: string): void {
            if (!ZipFile.DEBUG) return;
            console.log(msg);
        }
    }
}