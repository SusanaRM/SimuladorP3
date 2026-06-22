// Memory System - 64K word memory with I/O mapping
export class Memory {
  constructor() {
    this.memory = new Uint16Array(65536);
    this._initDevices();
  }

  _initDevices() {
    this.ioDevices = {
      0xfffe: { name: "TEXT_OUTPUT", value: 0 },
      0xffff: { name: "TEXT_INPUT", value: 0 },
      0xfff8: { name: "LEDS", value: 0 },
      0xfff9: { name: "SWITCHES", value: 0 },
      0xfff4: { name: "LCD_DATA", value: 0 },
      0xfff5: { name: "LCD_CONTROL", value: 0 },
      0xfff6: { name: "TIMER_LOW", value: 0 },
      0xfff7: { name: "TIMER_HIGH", value: 0 },
    };
  }

  reset() {
    this.memory.fill(0);
    for (const device of Object.values(this.ioDevices)) {
      device.value = 0;
    }
  }

  read(address) {
    address &= 0xffff;

    if (address >= 0xff00 && address <= 0xffff) {
      const device = this.ioDevices[address];
      if (device) {
        switch (device.name) {
          case "TEXT_INPUT":
            return device.value;
          case "SWITCHES":
            return 0xaaaa;
          case "TIMER_LOW":
            device.value = (device.value + 1) & 0xffff;
            return device.value;
          case "TIMER_HIGH":
            return 0;
          default:
            return device.value;
        }
      }
    }

    return this.memory[address];
  }

  write(address, value) {
    address &= 0xffff;
    value &= 0xffff;

    if (address >= 0xff00 && address <= 0xffff) {
      const device = this.ioDevices[address];
      if (device) {
        switch (device.name) {
          case "TEXT_OUTPUT":
            console.log(`[TEXT_OUTPUT] ${String.fromCharCode(value & 0xff)}`);
            device.value = value;
            break;
          case "LEDS":
            console.log(
              `[LEDS] Binary: ${(value >>> 0).toString(2).padStart(16, "0")}`,
            );
            device.value = value;
            break;
          case "LCD_DATA":
            console.log(`[LCD_DATA] ${value.toString(16).toUpperCase()}`);
            device.value = value;
            break;
          case "LCD_CONTROL":
            console.log(`[LCD_CONTROL] ${value.toString(16).toUpperCase()}`);
            device.value = value;
            break;
          default:
            device.value = value;
        }
        return;
      }
    }

    this.memory[address] = value;
  }

  getDeviceValue(address) {
    const device = this.ioDevices[address];
    return device ? device.value : null;
  }

  setDeviceValue(address, value) {
    const device = this.ioDevices[address];
    if (device) {
      device.value = value & 0xffff;
    }
  }

  isIOAddress(address) {
    return address >= 0xff00 && address <= 0xffff;
  }

  slice(start, end) {
    return this.memory.slice(start, end);
  }

  load(words) {
    this.reset();
    for (let i = 0; i < words.length; i++) {
      this.write(i, words[i]);
    }
  }
}

export const memory = new Memory();

export function readMemory(address) {
  return memory.read(address);
}

export function writeMemory(address, value) {
  return memory.write(address, value);
}

export function getDeviceValue(address) {
  return memory.getDeviceValue(address);
}

export function setDeviceValue(address, value) {
  return memory.setDeviceValue(address, value);
}

export function isIOAddress(address) {
  return memory.isIOAddress(address);
}
