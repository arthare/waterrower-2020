
const EventEmitter = require("events");
const fs = require('fs');

class Concept2Debug extends EventEmitter {
  frames = [];
  ixFrame = 0;
  constructor() {
    super();
    const dirFiles = fs.readdirSync('./samples/concept2');
    this.frames = dirFiles.map((fileName) => {
      const json = JSON.parse(fs.readFileSync(`./samples/concept2/${fileName}`));
      const buf = Buffer.from(json.buffer.data);
      return {buffer: buf};
    });
    this.ixFrame = 0;
  }

  write() {
    // don't care what you wrote, just emit the next frame shortly, as if we just did an async read
    setTimeout(() => {
      const ixSend = this.ixFrame % this.frames.length;
      const frameToSend = this.frames[ixSend];
      this.emit('frame', frameToSend);
      this.ixFrame++;
    }, 100);
  }
}

module.exports = Concept2Debug;