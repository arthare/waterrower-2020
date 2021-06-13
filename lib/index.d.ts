/// <reference types="node" />
import { Observable, Subject } from 'rxjs/Rx';
import * as events from 'events';
export declare class WaterRower extends events.EventEmitter {
    private refreshRate;
    private baudRate;
    private port;
    private dataDirectory;
    private datapoints;
    private recordingSubscription;
    reads$: Subject<ReadValue>;
    datapoints$: Observable<DataPoint>;
    constructor(options?: WaterRowerOptions);
    private discoverPort;
    private setupSerialPort;
    private setupStreams;
    private send;
    private initialize;
    private close;
    reset(): void;
    requestDataPoints(points?: string | string[]): void;
    readDataPoints(points?: string | string[]): any;
    startRecording(name?: string): void;
    stopRecording(): void;
    getRecordings(): string[];
    playRecording(name?: string): void;
    startSimulation(): void;
    defineDistanceWorkout(distance: number, units?: Units): void;
    defineDurationWorkout(seconds: number): void;
    displaySetDistance(units: Units): void;
    displaySetIntensity(option: IntensityDisplayOptions): void;
    displaySetAverageIntensity(option: AverageIntensityDisplayOptions): void;
}
export interface WaterRowerOptions {
    portName?: string;
    baudRate?: number;
    refreshRate?: number;
    dataDirectory?: string;
    datapoints?: string | string[];
}
export interface DataPoint {
    time?: Date;
    name?: string;
    address: string;
    length: string;
    value: any;
}
export interface ReadValue {
    time: number;
    type: string;
    data: string;
}
export declare enum IntensityDisplayOptions {
    MetersPerSecond = 0,
    MPH = 1,
    _500m = 2,
    _2km = 3,
    Watts = 4,
    CaloriesPerHour = 5
}
export declare enum AverageIntensityDisplayOptions {
    AverageMetersPerSecond = 0,
    AverageMPH = 1,
    _500m = 2,
    _2km = 3
}
export declare enum Units {
    Meters = 1,
    Miles = 2,
    Kilometers = 3,
    Strokes = 4
}
