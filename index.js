var {WaterRower} = require('waterrower');
const bleno = require('bleno');
bleno.on('stateChange', function(state) {
    console.log('on stateChange: ' + state);
    if (state === 'poweredOn') {
      bleno.startAdvertising('Waterrower RPi', ['1818']);
    } else {
      bleno.stopAdvertising();
    }
});

let g_fnUpdateBleCpsPowerValue = null;

let lastPowerToSendZwift = 0;
function sendPowerUpdate() {
  // what does a CPS power submission look like?
  // 2 bytes: uint16 flags
  // 2 bytes: uint16 power

  // if(wheelFlagSet)
  //      4 bytes: uint32 wheel revolution count
  //      2 bytes: last wheel event time

  // if(crankFlagSet)
          // it won't be!
  
  const buffer = Buffer.alloc(4);
  buffer.writeUInt16LE(0, 0);
  buffer.writeUInt16LE(lastPowerToSendZwift, 2);

  if(g_fnUpdateBleCpsPowerValue) {
    console.log("BLE CPS Reported ", lastPowerToSendZwift);
    g_fnUpdateBleCpsPowerValue(buffer);
  
    setTimeout(sendPowerUpdate, 500);
  }
}

function newPowerReport(watts) {
  lastPowerToSendZwift = watts;
  console.log("watts = ", watts);
}

bleno.on('advertisingStart', function(error) {
  if (!error) {
    bleno.setServices([
      // CPS
      new bleno.PrimaryService({
        uuid: '1818', // cycling power service
        characteristics: [
          // Alert Level
          new bleno.Characteristic({
            value: 0, 
            uuid: '2A63', // cycling power measurement
            properties: ['notify'],
            onSubscribe(maxValueSize, fnUpdatePowerValue) {
              g_fnUpdateBleCpsPowerValue = fnUpdatePowerValue;

              sendPowerUpdate();
            },
            onUnsubscribe() {
              g_fnUpdateBleCpsPowerValue = null;
            }
          }),
        ],
      }),
    ]);
  }
});


let waterrower = new WaterRower({
  datapoints:['kcal_watts'],
});

if(process.argv[2] === 'test') {
  waterrower.playRecording('simulationdata');
} else {
  // it'll just initialize otherwise
}

let zeroTimeout;

waterrower.on('initialized', () => {
  waterrower.reset();
  //waterrower.startRecording();
    
  waterrower.on('data', d => {
    // access the value that just changed using d
    // or access any of the other datapoints using waterrower.readDataPoint('<datapointName>');
    switch(d.name) {
      case 'kcal_watts':
        // the waterrower sends power numbers like 0-0-0-0-0-255-0-0-0-0-0-0-123-0-0-0-0-0.
        // if we sent all the zeroes, you'd average like 30 watts because you'd only be nonzero for like 250ms before the next zero shows up.
        // so I'm going to only report the positive numbers, and zero things out after 5 seconds of zeroes.
        if(d.value !== 0) {
          newPowerReport(d.value);

          clearTimeout(zeroTimeout);
          zeroTimeout = setTimeout(() => {
            newPowerReport(0);
          }, 5000);
        }
        break;
    
    }
  });
})
newPowerReport(0);
