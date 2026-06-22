import { AssemblerResult } from "./assembler-result.js";
import { Instruction } from "./instruction.js";

/**
 * Custom error class for assembly errors
 * @extends Error
 */
export class AssemblerError extends Error {
  /**
   * @param {string} message - Error message
   * @param {?number} [line] - Optional line number
   * @param {?Instruction} instruction
   * @param {?AssemblerResult} result
   */
  constructor(message, line, instruction, result) {
    super(message);
    this.name = "AssemblerError";
    this.assemblerMessage = message;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.line = line || null;
    this.instruction = instruction;
    this.result = result;
    if (this.instruction) {
      this.assemblerMessage = this.assemblerMessage.replace(
        "{name}",
        this.instruction.name,
      );
      if (this.instruction.debug && this.line === null) {
        this.line = this.instruction.debug.line;
      }
    }

    this.message = this.getFullMessage();
  }

  /**
   * Get full error message with line number if available
   * @returns {string}
   */
  getFullMessage() {
    if (this.line) {
      return this.assemblerMessage + ", on line " + this.line;
    }
    return this.assemblerMessage;
  }

  /**
   * Convert error to string representation
   * @returns {string}
   */
  toString() {
    return `AssemblerError: ${this.getFullMessage()}`;
  }
}
