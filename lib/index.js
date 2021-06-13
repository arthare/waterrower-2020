"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Units = exports.AverageIntensityDisplayOptions = exports.IntensityDisplayOptions = exports.WaterRower = void 0;
const Rx_1 = require("rxjs/Rx");
const SerialPort = require("serialport");
const ayb = require("all-your-base");
const _ = require("lodash");
const events = require("events");
const datapoints_1 = require("./datapoints");
const types_1 = require("./types");
const fs = require("fs");
const readline = require("readline");
const moment = require("moment");
const path = require("path");
class WaterRower extends events.EventEmitter {
    constructor(options = {}) {
        super();
        this.refreshRate = 200;
        this.baudRate = 19200;
        this.dataDirectory = 'lib/data';
        // reads$ is all serial messages from the WR
        // datapoints$ isonly the reads that are a report of a memory location's value 
        this.reads$ = new Rx_1.Subject();
        this.dataDirectory = options.dataDirectory || this.dataDirectory;
        this.refreshRate = options.refreshRate || this.refreshRate;
        this.baudRate = options.baudRate || this.baudRate;
        this.datapoints = options.datapoints;
        if (!options.portName) {
            console.log('No port configured. Attempting to discover...');
            this.discoverPort(name => {
                if (name) {
                    console.log('Discovered a WaterRower on ' + name + '...');
                    options.portName = name;
                    this.setupSerialPort(options);
                }
                else
                    console.log('We didn\'t find any connected WaterRowers');
            });
        }
        else {
            console.log('Setting up serial port on ' + options.portName + '...');
            this.setupSerialPort(options);
        }
        this.setupStreams();
        process.on('SIGINT', () => {
            this.close();
        });
    }
    discoverPort(callback) {
        SerialPort.list((err, ports) => {
            const p = _.find(ports, p => _.includes([
                'Microchip Technology, Inc.',
                'Microchip Technology Inc.' // macOS specific?
            ], p.manufacturer));
            if (p)
                callback(p.comName);
            else
                callback();
        });
    }
    setupSerialPort(options) {
        // setup the serial port
        this.port = new SerialPort(options.portName, {
            baudRate: options.baudRate || this.baudRate
        });
        // setup port events
        this.port.on('open', () => {
            console.log(`A connection to the WaterRower has been established on ${options.portName}`);
            this.initialize();
            if (options.refreshRate !== 0)
                setInterval(() => this.requestDataPoints(this.datapoints), this.refreshRate);
        });
        this.port.on('data', d => {
            let type = _.find(types_1.default, t => t.pattern.test(d));
            this.reads$.next({ time: Date.now(), type: (type ? type.type : 'other'), data: d });
        });
        this.port.on('closed', () => this.close);
        this.port.on('disconnect', () => this.close);
        this.port.on('error', err => {
            this.emit('error', err);
            this.close();
        });
    }
    setupStreams() {
        // this is the important stream for reading memory locations from the rower
        // IDS is a single, IDD is a double, and IDT is a triple byte memory location
        this.datapoints$ = this.reads$
            .filter(d => d.type === 'datapoint')
            .map(d => {
            let pattern = _.find(types_1.default, t => t.type == 'datapoint').pattern;
            let m = pattern.exec(d.data);
            return {
                time: new Date(d.time),
                name: _.find(datapoints_1.default, point => point.address == m[2]).name,
                length: { 'S': 1, 'D': 2, 'T': 3 }[m[1]],
                address: m[2],
                value: m[3]
            };
        });
        //emit the data event
        this.datapoints$.subscribe(d => {
            let datapoint = _.find(datapoints_1.default, d2 => d2.address == d.address);
            datapoint.value = parseInt(d.value, datapoint.radix);
            this.emit('data', datapoint);
        });
        // when the WR comes back with _WR_ then consider the WR initialized
        this.reads$.filter(d => d.type == 'hardwaretype').subscribe(d => {
            this.emit('initialized');
        });
    }
    /// send a serial message
    send(value) {
        if (this.port)
            this.port.write(value + '\r\n');
    }
    /// initialize the connection    
    initialize() {
        console.log('Initializing port...');
        this.send('USB');
    }
    close() {
        console.log('Closing WaterRower...');
        this.emit('close');
        this.reads$.complete();
        if (this.port) {
            this.port.close(err => console.log(err));
            this.port = null;
        }
        process.exit();
    }
    /// reset console
    reset() {
        console.log('Resetting WaterRower...');
        this.send('RESET'); //reset the waterrower 
    }
    /// Issues a request for one, more, or all data points.
    /// There is no return value. Data point values can be read very
    /// shortly after the request is made 
    requestDataPoints(points) {
        let req = (name) => {
            console.log('requesting ' + name);
            let dataPoint = _.find(datapoints_1.default, d => d.name == name);
            this.send(`IR${dataPoint.length}${dataPoint.address}`);
        };
        if (points) {
            if (Array.isArray(points))
                points.forEach(p => req(p));
            else if (typeof points === 'string')
                req(points);
            else
                throw ('requestDataPoint requires a string, an array of strings, or nothing at all');
        }
        else
            datapoints_1.default.forEach(d => req(d.name));
    }
    readDataPoints(points) {
        if (points) {
            if (Array.isArray(points)) {
                return datapoints_1.default
                    .filter(dp => points.some(p => p == dp.name)) //filter to the points that were passed in
                    .reduce((p, c) => { p[c.name] = c.value; return p; }, {}); //build up an array of the chosen points
            }
            else if (typeof points === 'string')
                return _.find(datapoints_1.default, d => d.name == points).value;
            else
                throw ('readDataPoints requires a string, an array of strings, or nothing at all');
        }
        else
            return datapoints_1.default.reduce((p, c) => p[c.name] = c.value, {});
    }
    startRecording(name) {
        name = name || moment().format('YYYY-MM-DD-HH-mm-ss');
        this.recordingSubscription = this.reads$
            .filter(r => r.type != 'pulse') //pulses are noisy
            .subscribe(r => fs.appendFileSync(path.join(this.dataDirectory, name), JSON.stringify(r) + '\n'));
    }
    stopRecording() {
        this.recordingSubscription.unsubscribe();
    }
    getRecordings() {
        return fs.readdirSync(this.dataDirectory);
    }
    playRecording(name) {
        name = name || 'simulationdata';
        let lineReader = readline.createInterface({ input: fs.createReadStream(path.join(this.dataDirectory, name), { encoding: 'utf-8' }) });
        let simdata$ = Rx_1.Observable.fromEvent(lineReader, 'line')
            .filter(value => (value ? true : false))
            .map(value => JSON.parse(value.toString()));
        let firstrow;
        simdata$.subscribe(row => {
            if (!firstrow)
                firstrow = row;
            let delta = row.time - firstrow.time;
            setTimeout(() => { this.reads$.next({ time: row.time, type: row.type, data: row.data }); }, delta);
        });
    }
    startSimulation() {
        this.playRecording();
    }
    /// set up new workout session on the WR with set distance
    defineDistanceWorkout(distance, units = Units.Meters) {
        this.send(`WSI${units}${ayb.decToHex(distance)}`);
    }
    /// set up new workout session on the WR with set duration
    defineDurationWorkout(seconds) {
        this.send(`WSU${ayb.decToHex(seconds)}`);
    }
    /// change the display to meters, miles, kilometers, or strokes
    displaySetDistance(units) {
        let value = 'DD';
        switch (units) {
            case Units.Meters:
                value += 'ME';
                break;
            case Units.Miles:
                value += 'MI';
                break;
            case Units.Kilometers:
                value += 'KM';
                break;
            case Units.Strokes:
                value += 'ST';
                break;
            default: throw 'units must be meters, miles, kilometers, or strokes';
        }
        this.send(value);
    }
    /// change the intensity display
    displaySetIntensity(option) {
        let value = 'DD';
        switch (option) {
            case IntensityDisplayOptions.MetersPerSecond:
                value += 'MS';
                break;
            case IntensityDisplayOptions.MPH:
                value += 'MPH';
                break;
            case IntensityDisplayOptions._500m:
                value += '500';
                break;
            case IntensityDisplayOptions._2km:
                value += '2KM';
                break;
            case IntensityDisplayOptions.Watts:
                value += 'WA';
                break;
            case IntensityDisplayOptions.CaloriesPerHour:
                value += 'CH';
                break;
        }
        this.send(value);
    }
    /// change the average intensity display
    displaySetAverageIntensity(option) {
        let value = 'DD';
        switch (option) {
            case AverageIntensityDisplayOptions.AverageMetersPerSecond:
                value += 'MS';
                break;
            case AverageIntensityDisplayOptions.AverageMPH:
                value += 'MPH';
                break;
            case AverageIntensityDisplayOptions._500m:
                value += '500';
                break;
            case AverageIntensityDisplayOptions._2km:
                value += '2KM';
                break;
            default: throw 'units must be meters, miles, kilometers, or strokes';
        }
        this.send(value);
    }
}
exports.WaterRower = WaterRower;
var IntensityDisplayOptions;
(function (IntensityDisplayOptions) {
    IntensityDisplayOptions[IntensityDisplayOptions["MetersPerSecond"] = 0] = "MetersPerSecond";
    IntensityDisplayOptions[IntensityDisplayOptions["MPH"] = 1] = "MPH";
    IntensityDisplayOptions[IntensityDisplayOptions["_500m"] = 2] = "_500m";
    IntensityDisplayOptions[IntensityDisplayOptions["_2km"] = 3] = "_2km";
    IntensityDisplayOptions[IntensityDisplayOptions["Watts"] = 4] = "Watts";
    IntensityDisplayOptions[IntensityDisplayOptions["CaloriesPerHour"] = 5] = "CaloriesPerHour";
})(IntensityDisplayOptions = exports.IntensityDisplayOptions || (exports.IntensityDisplayOptions = {}));
var AverageIntensityDisplayOptions;
(function (AverageIntensityDisplayOptions) {
    AverageIntensityDisplayOptions[AverageIntensityDisplayOptions["AverageMetersPerSecond"] = 0] = "AverageMetersPerSecond";
    AverageIntensityDisplayOptions[AverageIntensityDisplayOptions["AverageMPH"] = 1] = "AverageMPH";
    AverageIntensityDisplayOptions[AverageIntensityDisplayOptions["_500m"] = 2] = "_500m";
    AverageIntensityDisplayOptions[AverageIntensityDisplayOptions["_2km"] = 3] = "_2km";
})(AverageIntensityDisplayOptions = exports.AverageIntensityDisplayOptions || (exports.AverageIntensityDisplayOptions = {}));
var Units;
(function (Units) {
    Units[Units["Meters"] = 1] = "Meters";
    Units[Units["Miles"] = 2] = "Miles";
    Units[Units["Kilometers"] = 3] = "Kilometers";
    Units[Units["Strokes"] = 4] = "Strokes";
})(Units = exports.Units || (exports.Units = {}));
//# sourceMappingURL=index.js.map