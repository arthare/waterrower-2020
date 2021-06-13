"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const __1 = require("..");
//simulation mode
let waterrower = new __1.WaterRower({ datapoints: ['ms_distance', 'm_s_total', 'm_s_average', 'total_kcal'] });
waterrower.playRecording('simulationdata');
console.log('Playing \'simulationdata\'');
waterrower.on('data', d => {
    console.log(JSON.stringify(d));
});
//# sourceMappingURL=index.js.map