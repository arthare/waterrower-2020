"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("..");
const chai_1 = require("chai");
const mocha_1 = require("mocha");
mocha_1.describe('waterrower', () => {
    //constructor
    mocha_1.describe('constructor', () => {
        mocha_1.it('can instantiate waterrower with no arguments', function () {
            let waterrower = new __1.WaterRower();
        });
        mocha_1.it('can instantiate waterrower with no arguments', function () {
            let waterrower = new __1.WaterRower();
        });
    });
    //session playback
    mocha_1.describe('session playback', () => {
        mocha_1.it('can playback default simulation data', function () {
            let waterrower = new __1.WaterRower();
            waterrower.playRecording('simulationdata');
        });
        mocha_1.it('can record a session', function () {
            let waterrower = new __1.WaterRower();
            waterrower.playRecording('simulationdata');
            waterrower.startRecording();
            setTimeout(function () { waterrower.stopRecording(); }, 10000);
        });
    });
    // datapoint processing
    mocha_1.describe('datapoint processing', () => {
        let waterrower;
        mocha_1.beforeEach(done => {
            waterrower = new __1.WaterRower();
            waterrower.setupStreams();
            done();
        });
        mocha_1.it('treats distance as a hexadecimal integer', done => {
            waterrower.once('data', point => {
                chai_1.assert.equal(point.name, 'distance');
                chai_1.assert.equal(point.value, 7350);
                done();
            });
            waterrower.reads$.next({ time: 1468559128188, type: 'datapoint', data: 'IDD0571CB6\r' });
        });
        mocha_1.it('treats display minutes as a decimal integer', done => {
            waterrower.once('data', point => {
                chai_1.assert.equal(point.name, 'display_min');
                chai_1.assert.equal(point.value, 28);
                done();
            });
            waterrower.reads$.next({ time: 1468559128188, type: 'datapoint', data: 'IDS1E228\r' });
        });
    });
});
//# sourceMappingURL=test.js.map