import { AssemblerError } from "./assembler-error.js";
import { MEMORY_SIZE } from "./consts.js";

// InstructionEncoder class - Encodes P3 ISA instructions into binary machine code
export class InstructionEncoder {
  constructor(memoryContext) {
    this._memoryContext = memoryContext;
    this._dataView = new DataView(this._memoryContext.buffer);
    this._cursorPos = 0;
    this.MAX_MEM_ADDR = MEMORY_SIZE;
  }

  getCursor() {
    if (this._cursorPos >= this.MAX_MEM_ADDR) {
      throw new Error("Internal Error: invalid memory position");
    }
    return this._cursorPos;
  }

  setCursor(addr) {
    if (addr >= this.MAX_MEM_ADDR) {
      throw new Error("Internal Error: invalid memory position");
    }
    this._cursorPos = addr;
  }

  advanceBy(delta) {
    this._cursorPos += delta;
  }

  storeValue(data, mode) {
    if (this._cursorPos >= this.MAX_MEM_ADDR) {
      throw new AssemblerError("End of memory reached");
    }
    if (this._memoryContext.usedAddresses[this._cursorPos]) {
      throw new AssemblerError("Overlapping memory");
    }
    this._dataView.setInt16(this._cursorPos * 2, data, true);
    this._memoryContext.usedAddresses[this._cursorPos] = mode || 1;
    this._memoryContext.memoryUsage++;
    this._cursorPos++;
  }

  emitOpZero(opcode) {
    opcode &= 0x3f; // 6 bits
    this.storeValue(opcode << 10);
  }

  emitOpConst(opcode, constVal) {
    opcode &= 0x3f; // 6 bits
    this.storeValue((opcode << 10) | (constVal & 0x3ff));
  }

  emitOpOneC(opcode, condCode, addrMode, regIdx, wordData) {
    opcode &= 0x3f; // 6 bits
    condCode &= 0x0f; // 4 bits
    addrMode &= 0x03; // 2 bits
    regIdx &= 0x0f; // 4 bits
    if (addrMode === 2) {
      regIdx = 0;
    }
    this.storeValue((opcode << 10) | (condCode << 6) | (addrMode << 4) | regIdx);
    if (addrMode === 2 || addrMode === 3) {
      this.storeValue(wordData);
    }
  }

  emitOpOne(opcode, addrMode, regIdx, wordData) {
    this.emitOpOneC(opcode, 0, addrMode, regIdx, wordData);
  }

  emitOpTwo(opcode, subAddr, srcReg, addrMode, dstReg, wordData) {
    subAddr &= 0x01; // 1 bits
    srcReg &= 0x07; // 3 bits
    this.emitOpOneC(opcode, (subAddr << 3) | srcReg, addrMode, dstReg, wordData);
  }

  emitJumpRel(opcode, dispVal) {
    this.emitJumpCondRel(opcode, 0, dispVal);
  }

  emitJumpCondRel(opcode, condCode, dispVal) {
    opcode &= 0x3f; // 6 bits
    condCode &= 0x0f; // 4 bits
    dispVal &= 0x3f; // 6 bits
    this.storeValue((opcode << 10) | (condCode << 6) | dispVal);
  }
}
