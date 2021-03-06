'use strict';

const
    fs = require('fs'),
    EventEmitter = require('events'),
    readLineLib = require('readline'),
    ParseError = require('../utils').ParseError,
    shouldAddEntry = function(from, to, entry) {
        return (
            (!from || entry.created.getTime() >= from.getTime()) &&
            (!to || entry.created.getTime() <= to.getTime())
        );
    };


class LogFileProcessor extends EventEmitter {

    /**
     * @param {MysqlLogParser} logEntryParser
     * @param {LogAnalyzer} logAnalyzer
     */
    constructor(logEntryParser, logAnalyzer) {
        super();
        this.logEntryParser = logEntryParser;
        this.logAnalyzer = logAnalyzer;
        this._entryData = '';
    }

    /**
     * @param {String} entryData
     */
    handleLogEntryData(entryData) {
        this.emit('beforeEntryParsed', entryData);
        try {
            let entry = this.logEntryParser.parse(entryData);
            if (shouldAddEntry(this.from, this.to, entry)) {
                this.emit('entryParsed', entry);
                this.logAnalyzer.addEntry(entry);
            }
        } catch (err) {
            if (err instanceof ParseError) {
                this.logAnalyzer.addUnknownEntry(entryData);
            } else {
                throw err;
            }
        }
    }

    /**
     * @param {String} line
     */
    processLogLine(line) {
        if (this.logEntryParser.isBeginningOfLogEntry(line)) {
            if (this._entryData !== '') {
                this.handleLogEntryData(this._entryData);
            }
            this._entryData = '';
        }
        this._entryData += line;
    }

    /**
     * @param {String} filePath
     * @returns {Promise}
     */
    readAndProcess(filePath) {
        return new Promise((resolve, reject) => {
            readLineLib
                .createInterface({
                    input: fs.createReadStream(filePath)
                })
                .on('line', this.processLogLine.bind(this))
                .on('close', resolve);
        });
    }

}

module.exports = LogFileProcessor;