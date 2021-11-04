var {WaterRower} = require('waterrower');
var Concept2 = require('concept2');
const {Command} = require('csafe');
const bleno = require('bleno');
const fs = require('fs');
const isConcept2 = process.argv.find((arg) => arg === 'concept2');
const Concept2Debug = require('./concept-2-debug');


const SURGE_LENGTH = 5000;
const isDebug = process.argv.find((arg) => arg === 'debug');
let g_tmLastConcept2Change = 0;
let g_lastConcept2Power = 0;
let g_fnUpdateBleCpsPowerValue = ()=>{};
let g_surges = [];

try {
  // only run bluetooth when we're not testing (aka when we're on the PI)
  bleno.on('stateChange', function(state) {
      console.log('on stateChange: ' + state);
      if (state === 'poweredOn') {
        bleno.startAdvertising('Waterrower Pwr', ['1818']);
      } else {
        bleno.stopAdvertising();
      }
  });

  
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
                console.log("they have subscribed!");
                g_fnUpdateBleCpsPowerValue = fnUpdatePowerValue;

                sendPowerUpdate();
              },
              onUnsubscribe() {
                console.log("they have unsubscribed!");
                g_fnUpdateBleCpsPowerValue = null;
              }
            }),
          ],
        }),
      ]);
    }
  });
} catch(e) {
  console.log("Looks like bleno (bluetooth) is not available on this computer ", e);

  // start the power update cycle so our debuggering programmer can take a look
  g_fnUpdateBleCpsPowerValue = (buf) => {
    console.log("fake cps update: ", buf);
  }
  sendPowerUpdate();
}



function surgeValue(tmStart, tmNow) {
  if(tmNow >= tmStart + SURGE_LENGTH) {
    return 0;
  }
  if(tmNow < tmStart) {
    return 0;
  }
  const seconds = (tmNow - tmStart) / 1000;

  // this function is designed to create a pleasant power surge that starts high, peaks 1 sec after the pull, and integrates to 1 joule over 5 seconds.
  // the caller shall multiply the shape by how many joules each yank on the rower caused, and that'll ensure the power #s are sane but also responsive.
  const x = seconds;
  const p1 = 2 / (Math.pow(x - 1, 2) + 1);
  const p2 = -0.22*x;
  const p3 = 1;
  return 0.154502750428695 *(p1 + p2 + p3);
}
function Surge(kJ) {
  for(var x = 0; x < 10; x++) {
    console.log("SURGE SURGE SURGE SURGE SURGE SURGE");
  }
  const tmStart = new Date().getTime();

  this.get = (tmNow) => {
    const val = surgeValue(tmStart, tmNow);
    return kJ * 1000 * val;
  }
  this.done = (tmNow) => {
    return tmNow > tmStart + SURGE_LENGTH;
  }
}

function surgeTick(tmNow) {

  if(isConcept2) {
    if(tmNow - g_tmLastConcept2Change <= 3000) {
      return g_lastConcept2Power;
    } else {
      return 0;
    }
  } else {
    g_surges = g_surges.filter((surge) => {
      return !surge.done(tmNow);
    });
  
    let sum = 0;
    g_surges.forEach((surge) => {
      sum += surge.get(tmNow);
    })
    return sum;
  }
}
function addSurge(kJ) {
  g_surges.push(new Surge(kJ));
}


function sendPowerUpdate() {
  // what does a CPS power submission look like?
  // 2 bytes: uint16 flags
  // 2 bytes: uint16 power

  // if(wheelFlagSet)
  //      4 bytes: uint32 wheel revolution count
  //      2 bytes: last wheel event time

  // if(crankFlagSet)
          // it won't be!
  const tmNow = new Date().getTime(); 
  const power = surgeTick(tmNow);

  const buffer = Buffer.alloc(8);
  buffer.writeUInt16LE(0, 0);
  buffer.writeUInt16LE(power, 2);

  if(g_fnUpdateBleCpsPowerValue) {
    console.log("BLE CPS Reported ", power);
    g_fnUpdateBleCpsPowerValue(buffer);
  
    setTimeout(sendPowerUpdate, 250);
  }
}

if(isConcept2) {
  console.log("they told us to start a concept2");
  try {
    let pm4;
    if(isDebug) {
      pm4 = new Concept2Debug();
    } else {
      pm4 = new Concept2();
    }
    pm4.on('frame', (frame) => {
      // hackishly, a frame looks like this:  { buffer: <Buffer f1 09 b4 03 9b 00 58 7d f2> }
      // the bytes we want are here                      
      
      const power = frame.buffer.readUInt16LE(4);
      console.log("Frame power was ", power, "bytes ", frame.buffer.readUInt8(4), frame.buffer.readUInt8(5));
      const tmNow = new Date().getTime();
      if(power !== g_lastConcept2Power) {
        g_tmLastConcept2Change = tmNow;
      }

      g_lastConcept2Power = power;
    });
    const getCadenceCmd = new Command('GetPower');
    setInterval(() => {
      pm4.write(getCadenceCmd);
    }, 750);

  } catch(e) {
    console.error("Error: ", e);
  }
} else {
  let waterrower = new WaterRower({
    datapoints:['total_kcal'],
  });
  
  if(process.argv.find((arg) => arg === 'test')) {
    waterrower.playRecording('simulationdata');
  } else {
    // it'll just initialize otherwise
  }
  
  let zeroTimeout;
  
  waterrower.on('initialized', () => {
    waterrower.reset();
    //waterrower.startRecording();
      
  
    let lastKCal = 0;
  
    waterrower.on('data', d => {
      // access the value that just changed using d
      // or access any of the other datapoints using waterrower.readDataPoint('<datapointName>');
      switch(d.name) {
        case 'total_kcal':
          const thisKCal = d.value;
          const deltaJ = thisKCal - lastKCal;
          lastKCal = thisKCal;
          if(deltaJ > 0 && lastKCal > 0) {
            addSurge(deltaJ / 1000);
          }
          break;
      }
    });
  })
}
