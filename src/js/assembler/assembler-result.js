import { MEMORY_SIZE, MEMORY_WORD_SIZE } from "./consts.js";
import { writeProgram } from "./program.js";

// Holds the result of assembly including generated code and metadata
export class AssemblerResult {
  memoryUsage = 0;
  labels = {};
  labelCount = 0;
  pseudoCount = 0;
  instructionCount = 0;

  constructor() {
    this.buffer = new ArrayBuffer(MEMORY_SIZE * MEMORY_WORD_SIZE);
    this.usedAddresses = Array(MEMORY_SIZE).fill(0);
  }

  /**
   * Get memory usage as a percentage
   * @returns {number}
   */
  getMemoryUsagePercentage() {
    return Math.floor((this.memoryUsage * 10000) / MEMORY_SIZE) / 100;
  }

  /**
   * Get memory usage string representation
   * @returns {string} Formatted memory usage string
   */
  getMemoryUsageString() {
    return (
      this.memoryUsage +
      "/" +
      MEMORY_SIZE +
      " (" +
      this.getMemoryUsagePercentage() +
      "%)"
    );
  }

  buildProgramCode(oldFormat) {
    return writeProgram(this.buffer, oldFormat, this.usedAddresses);
  }
}
