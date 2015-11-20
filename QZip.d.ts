/**************************
 * Type definition for QZip v1.0
 * by Qi Zhao
 *
 **************************/

/**
 * QZip namespace
 */
declare module QZip {

    /**
     * Represent a file/dir entry in zip file
     */
    interface ZipEntry {

        /**
         * Whether this entry is an zip 64 entry
         */
        zip64: boolean;

        /**
         * Last modified date of this entry
         */
        date: Date;

        /**
         * Uncompressed size in bytes
         */
        uncompressedSize: number;

        /**
         * Filename with relative path
         */
        fileName: string;

        /**
         * Whether this entry is a directory or file
         */
        isDir: boolean;
    }

    /**
     * Represent a Zip file
     */
    interface ZipFile {

        /**
         * Create a zip file instance and bind onload and onerror events
         */
        new (file: any, onload: (entries: Array<ZipEntry>) => void, onerror: (msg: string) => void): ZipFile;
    }

    /**
     * Initialize a zip file instance
     */
    var ZipFile: ZipFile;
}

declare module "QZip" {
    export = QZip;
}