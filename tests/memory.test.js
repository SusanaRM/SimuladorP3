import {
  readMemory,
  writeMemory,
  getDeviceValue,
  setDeviceValue,
  isIOAddress,
  memory,
} from "../src/js/memory-system/memory.js";

describe("Memory System", () => {
  beforeEach(() => {
    memory.reset();
  });

  describe("Basic Memory Operations", () => {
    test("should read and write regular memory", () => {
      writeMemory(0x1000, 0xabcd);
      expect(readMemory(0x1000)).toBe(0xabcd);
    });

    test("should handle 16-bit wrapping", () => {
      writeMemory(0x2000, 0x12345); // Should wrap to 0x2345
      expect(readMemory(0x2000)).toBe(0x2345);
    });

    test("should handle address wrapping", () => {
      writeMemory(0x10000, 0xffff); // Should wrap to address 0
      expect(readMemory(0x0000)).toBe(0xffff);
    });
  });

  describe("I/O Device Mapping", () => {
    test("should identify I/O addresses", () => {
      expect(isIOAddress(0xff00)).toBe(true);
      expect(isIOAddress(0xffff)).toBe(true);
      expect(isIOAddress(0xfeff)).toBe(false);
      expect(isIOAddress(0x0000)).toBe(false);
    });

    test("should read from TEXT_INPUT device", () => {
      const value = readMemory(0xffff);
      expect(value).toBe(0); // Simulated input
    });

    test("should read from SWITCHES device", () => {
      const value = readMemory(0xfff9);
      expect(value).toBe(0xaaaa); // Simulated switch values
    });

    test("should read from TIMER_LOW device", () => {
      const value1 = readMemory(0xfff6);
      const value2 = readMemory(0xfff6);
      expect(value2).toBe(value1 + 1); // Timer should increment
    });

    test("should read from TIMER_HIGH device", () => {
      const value = readMemory(0xfff7);
      expect(value).toBe(0); // High word
    });

    test("should write to TEXT_OUTPUT device", () => {
      // Test that writing to TEXT_OUTPUT doesn't crash and updates device value
      writeMemory(0xfffe, 0x0041); // ASCII 'A'
      expect(getDeviceValue(0xfffe)).toBe(0x0041);
    });

    test("should write to LEDS device", () => {
      writeMemory(0xfff8, 0x0f0f);
      expect(getDeviceValue(0xfff8)).toBe(0x0f0f);
    });

    test("should write to LCD devices", () => {
      writeMemory(0xfff4, 0x1234); // LCD Data
      writeMemory(0xfff5, 0x5678); // LCD Control

      expect(getDeviceValue(0xfff4)).toBe(0x1234);
      expect(getDeviceValue(0xfff5)).toBe(0x5678);
    });
  });

  describe("Device Value Management", () => {
    test("should get and set device values", () => {
      setDeviceValue(0xfff8, 0xffff);
      expect(getDeviceValue(0xfff8)).toBe(0xffff);

      setDeviceValue(0xfff8, 0x12345); // Should wrap to 0x2345
      expect(getDeviceValue(0xfff8)).toBe(0x2345);
    });

    test("should return null for non-existent devices", () => {
      expect(getDeviceValue(0xf000)).toBeNull();
    });
  });
});
