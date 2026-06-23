import { readMemory, writeMemory } from '../memory-system/memory.js';
import { defaultRomA, defaultRomB, defaultRomC } from './roms.js';

export class CPU {
  // Modern class property initialization
  isDebuggingEnabled = false;

  constructor(memorySystem = null) {
    this.memorySubsystem = memorySystem || { read: readMemory, write: writeMemory };
    
    this.controlRomA = null;
    this.controlRomB = null;
    this.controlRomC = null;
    
    this.reloadControlRomA();
    this.reloadControlRomB();
    this.reloadControlRomC();
    
    this.initializeProcessorState();
  }

  /**
   * Sets up or re-initializes all internal processor storage structures and control lines.
   */
  initializeProcessorState() {
    this.hardwareRegisters = new Array(16).fill(0);
    this.instructionRegister = 0;          
    this.statusRegister = 0;          
    this.controlAddressRegister = 0;         
    this.subroutineBranchRegister = 0;         
    this.interruptSignalFlag = 0;         
    this.interruptAcknowledgeFlag = 0;         
    this.microcodeCache = null;
    this.decodedInstructionCache = null;
    this.cycleCounter = 0;
    this.executedInstructionCounter = 0;
  }

  // Backward-compatibility alias for internal resets
  reset() {
    this.initializeProcessorState();
  }

  // Backward-compatibility alias for debugging flags
  get _debug() { return this.isDebuggingEnabled; }
  set _debug(value) { this.isDebuggingEnabled = value; }
  
  /**
   * Drives the system clock continuously until a complete instruction lifecycle finishes.
   */
  step() {
    let hasInstructionCompleted = false;
    while (!hasInstructionCompleted) {
      hasInstructionCompleted = this.executeSingleClockCycle();
    }
  }

  /**
   * Enumerable plain-object mapping supporting 16-to-32-bit sign-extended transformations,
   * keeping downstream diagnostic suites, spreads, and JSON structural audits perfectly happy.
   */
  get registers() {
    const registerProxyMap = {};
    
    // Bind registers R0 through R13
    for (let regIndex = 0; regIndex < 14; regIndex++) {
      Object.defineProperty(registerProxyMap, `R${regIndex}`, {
        get: () => this.hardwareRegisters[regIndex] & 0xffff,
        set: (value) => { 
          this.hardwareRegisters[regIndex] = (value << 16) >> 16; 
        },
        enumerable: true,
        configurable: true
      });
    }
    
    // Bind Stack Pointer (R14)
    Object.defineProperty(registerProxyMap, 'SP', {
      get: () => this.hardwareRegisters[14] & 0xffff,
      set: (value) => { 
        this.hardwareRegisters[14] = (value << 16) >> 16; 
      },
      enumerable: true,
      configurable: true
    });
    
    // Bind Program Counter (R15)
    Object.defineProperty(registerProxyMap, 'PC', {
      get: () => this.hardwareRegisters[15] & 0xffff,
      set: (value) => { 
        this.hardwareRegisters[15] = (value << 16) >> 16; 
      },
      enumerable: true,
      configurable: true
    });
    
    return registerProxyMap;
  }

  /**
   * Exposes individual status register flags safely mapped into booleans.
   */
  get flags() {
    return {
      Z: !!(this.statusRegister & 0x08),
      C: !!(this.statusRegister & 0x04),
      N: !!(this.statusRegister & 0x02),
      O: !!(this.statusRegister & 0x01),
      E: !!(this.statusRegister & 0x10),
      c: !!(this.statusRegister & 0x20),
      z: !!(this.statusRegister & 0x40),
    };
  }

  // Public Compatibility Accessors
  getRegister(registerIndex) { return this.hardwareRegisters[registerIndex] & 0xffff; }
  get SP() { return this.hardwareRegisters[14] & 0xffff; }
  get PC() { return this.hardwareRegisters[15] & 0xffff; }
  get RI() { return this.instructionRegister & 0xffff; }
  get RE() { return this.statusRegister & 0x7f; }
  get CAR() { return this.controlAddressRegister & 0xffff; }
  get SBR() { return this.subroutineBranchRegister & 0xffff; }
  get INT() { return this.interruptSignalFlag & 1; }
  get IAK() { return this.interruptAcknowledgeFlag & 1; }

  // CORE MICROARCHITECTURAL DECODERS & INTERNAL HARDWARE FUNCTIONS

  /**
   * Extracts concrete functional components out of raw instruction register sequences.
   */
  decodeInstructionFields(rawInstruction) {
    return {
      op:  (rawInstruction >> 10) & 0x3f,
      s:   (rawInstruction >>  9) & 0x1,
      ir2: (rawInstruction >>  6) & 0x7,
      m:   (rawInstruction >>  4) & 0x3,
      ir1: (rawInstruction >>  0) & 0xf,
      c:   (rawInstruction >>  6) & 0xf,
      d:   (rawInstruction >>  0) & 0x3f,
    };
  }

  /**
   * Isolates separate control signals and addresses embedded within microcode entries.
   */
  decodeMicrocodeFields(rawMicrocode) {
    return {
      f:     (rawMicrocode >> 31) & 0x01,
      rad:   (rawMicrocode >>  0) & 0xf,
      mad:   (rawMicrocode >>  4) & 0x1,
      md:    (rawMicrocode >>  5) & 0x3,
      wr:    (rawMicrocode >>  7) & 0x1,
      sr2:   (rawMicrocode >> 27) & 0x1,
      sr1:   (rawMicrocode >> 28) & 0x1,
      m5:    (rawMicrocode >> 29) & 0x3,
      wm:    (rawMicrocode >>  8) & 0x1,
      rb:    (rawMicrocode >>  9) & 0xf,
      mrb:   (rawMicrocode >> 13) & 0x1,
      m2:    (rawMicrocode >> 14) & 0x1,
      mb:    (rawMicrocode >> 15) & 0x1,
      ma:    (rawMicrocode >> 16) & 0x1,
      cula:  (rawMicrocode >> 17) & 0x1f,
      fm:    (rawMicrocode >> 22) & 0xf,
      iak:   (rawMicrocode >> 26) & 0x1,
      const: (rawMicrocode >>  8) & 0xfff,
      lf:    (rawMicrocode >> 20) & 0x1,
      li:    (rawMicrocode >> 21) & 0x1,
      cc:    (rawMicrocode >> 22) & 0x1,
      mcond: (rawMicrocode >> 23) & 0x7,
      ls:    (rawMicrocode >> 26) & 0x1,
    };
  }

  /**
   * Ensures internal pipeline optimization mirrors stay populated for cycle execution.
   */
  populateProcessorCaches() {
    if (!this.microcodeCache) {
      this.microcodeCache = [];
      this.controlRomC.forEach((microWord) => {
        this.microcodeCache.push(this.decodeMicrocodeFields(microWord));
      });
    }
    if (!this.decodedInstructionCache) {
      this.decodedInstructionCache = this.decodeInstructionFields(this.instructionRegister);
    }
  }

  /**
   * Reads information from system memory bus, ensuring automatic sign extension.
   */
  fetchFromMemory(memoryAddress) {
    const rawVal = this.memorySubsystem.read(memoryAddress & 0xffff);
    return (rawVal << 16) >> 16; 
  }

  /**
   * Safe data write back out to system memory infrastructure.
   */
  commitToMemory(memoryAddress, dataValue) {
    this.memorySubsystem.write(memoryAddress & 0xffff, dataValue & 0xffff);
  }

  /**
   * Mimics the core arithmetic and logic hardware array, computing outputs alongside condition vectors.
   */
  executeArithmeticLogicUnit(operandA, operandB, controlOpcode, carryInLine) {
    if (operandA !== (operandA & 0xffffffff) || operandB !== (operandB & 0xffffffff)) {
      throw new Error('ALU error, invalid operand (not integer)');
    }
    
    const bitmaskValidation = (operandA & 0xffff8000) ^ (operandB & 0xffff8000);
    if (bitmaskValidation !== 0 && (bitmaskValidation ^ 0xffff8000) !== 0) {
      throw new Error('ALU error, invalid operand (invalid number)');
    }
    
    let sanitizedOpcode = controlOpcode & 0x1f;
    const maskedCarry = carryInLine & 0x1;
    let aluOutput = 0, targetZero = 0, targetCarry = 0, targetNegative = 0, targetOverflow = 0;
    
    // Normalize mapping quirks for basic instructions
    switch (sanitizedOpcode) {
      case 4: sanitizedOpcode = 1; operandB = 1; break;
      case 5: sanitizedOpcode = 0; operandB = 1; break;
      case 6: operandB = 1; sanitizedOpcode = (!maskedCarry ? 1 : 24); break;
      case 7: operandB = 1; sanitizedOpcode = (maskedCarry ? 0 : 24); break;
    }
    
    switch (sanitizedOpcode) {
      case 0:
      case 2:
        aluOutput = operandA + operandB + (sanitizedOpcode === 2 && maskedCarry ? 1 : 0);
        aluOutput = (aluOutput << 16) >> 16;
        if ((operandA & operandB & 0x8000) !== 0 || ((operandA ^ operandB) & ~aluOutput & 0x8000) !== 0) targetCarry = 1;
        if ((((operandA ^ operandB) & 0x8000) === 0) && (((operandA ^ aluOutput) & 0x8000) !== 0)) targetOverflow = 1;
        break;
      case 1:
      case 3:
        aluOutput = operandA - operandB - (sanitizedOpcode === 3 && !maskedCarry ? 1 : 0);
        aluOutput = (aluOutput << 16) >> 16;
        if ((operandA & ~operandB & 0x8000) !== 0 || (~(operandA ^ operandB) & ~aluOutput & 0x8000) !== 0) targetCarry = 1;
        if ((((operandA ^ operandB) & 0x8000) !== 0) && (((operandA ^ aluOutput) & 0x8000) !== 0)) targetOverflow = 1;
        break;
      case 8:
      case 12: 
        aluOutput = ~operandA; 
        break;
      case 9:
      case 13: 
        aluOutput = operandA & operandB; 
        break;
      case 10:
      case 14: 
        aluOutput = operandA | operandB; 
        break;
      case 11:
      case 15: 
        aluOutput = operandA ^ operandB; 
        break;
      case 16:
        targetCarry = operandA & 0x1;
        aluOutput = (operandA >> 1) & 0x00007fff;
        break;
      case 17:
        targetCarry = (operandA >> 15) & 0x1;
        aluOutput = operandA << 1;
        if (targetCarry !== ((aluOutput >> 15) & 0x1)) {
          aluOutput = (aluOutput << 16) >> 16;
        }
        break;
      case 18:
        targetCarry = operandA & 0x1;
        aluOutput = operandA >> 1;
        break;
      case 19:
        targetCarry = (operandA >> 15) & 0x1;
        aluOutput = operandA << 1;
        if (targetCarry !== ((aluOutput >> 15) & 0x1)) {
          aluOutput = (aluOutput << 16) >> 16;
          targetOverflow = 1;
        }
        break;
      case 20:
        targetCarry = operandA & 0x1;
        aluOutput = (operandA & 0xffff) >> 1;
        aluOutput |= targetCarry << 15;
        aluOutput = (aluOutput << 16) >> 16;
        break;
      case 21:
        targetCarry = (operandA >> 15) & 0x1;
        aluOutput = (operandA << 1) & 0xffff;
        aluOutput |= targetCarry;
        aluOutput = (aluOutput << 16) >> 16;
        break;
      case 22:
        targetCarry = operandA & 0x1;
        aluOutput = (operandA & 0xffff) >> 1;
        aluOutput |= maskedCarry << 15;
        aluOutput = (aluOutput << 16) >> 16;
        break;
      case 23:
        targetCarry = (operandA >> 15) & 0x1;
        aluOutput = (operandA << 1) & 0xffff;
        aluOutput |= maskedCarry;
        aluOutput = (aluOutput << 16) >> 16;
        break;
      default:
        aluOutput = operandA;
        break;
    }
    
    if (aluOutput === 0) {
      targetZero = 1;
    } else if ((aluOutput & 0x8000) !== 0) {
      targetNegative = 1;
    }
    
    return {
      result: aluOutput,
      zcno: (targetZero << 3) | (targetCarry << 2) | (targetNegative << 1) | targetOverflow,
    };
  }

  /**
   * Executes exactly one hardware-level step across the microcode execution matrices.
   */
  executeSingleClockCycle() {
    this.populateProcessorCaches();
    const currentInstruction = this.decodedInstructionCache;
    const currentMicrocode = this.microcodeCache[this.controlAddressRegister];
  
    if (currentMicrocode.f && currentMicrocode.ls) {
      this.subroutineBranchRegister = (this.controlAddressRegister + 1) & 0xffff;
    }
    
    if (currentMicrocode.m5 === 0) {
      let evaluatesTrue = 0;
      if (currentMicrocode.f) {
        let internalConditionLine;
        switch (currentMicrocode.mcond) {
          case 0: internalConditionLine = 1; break;
          case 1: internalConditionLine = (this.statusRegister >> 6) & 0x1; break;
          case 2: internalConditionLine = (this.statusRegister >> 5) & 0x1; break;
          case 3: internalConditionLine = (this.statusRegister >> 4) & this.interruptSignalFlag & 0x1; break;
          case 4: internalConditionLine = (currentInstruction.m >> 0) & 0x1; break;
          case 5: internalConditionLine = (currentInstruction.m >> 1) & 0x1; break;
          case 6: internalConditionLine = (currentInstruction.op >> 5) & ~(currentInstruction.op >> 4) & currentInstruction.s & 0x1; break;
          case 7:
            switch (currentInstruction.c >> 1) {
              case 0: internalConditionLine = (this.statusRegister >> 3) & 0x1; break;
              case 1: internalConditionLine = (this.statusRegister >> 2) & 0x1; break;
              case 2: internalConditionLine = (this.statusRegister >> 1) & 0x1; break;
              case 3: internalConditionLine = (this.statusRegister >> 0) & 0x1; break;
              case 4: internalConditionLine = ~((this.statusRegister >> 3) | (this.statusRegister >> 1)) & 0x1; break;
              case 5: internalConditionLine = this.interruptSignalFlag & 0x1; break;
            }
            internalConditionLine ^= (currentInstruction.c & 0x1);
            break;
        }
        evaluatesTrue = internalConditionLine ^ currentMicrocode.cc;
      }
      
      if (currentMicrocode.f && evaluatesTrue) {
        this.controlAddressRegister = currentMicrocode.const & 0xffff;
      } else {
        this.controlAddressRegister = (this.controlAddressRegister + 1) & 0xffff;
      }
    } else if (currentMicrocode.m5 === 1) {
      this.controlAddressRegister = this.subroutineBranchRegister;
    } else if (currentMicrocode.m5 === 2) {
      this.controlAddressRegister = this.controlRomA[currentInstruction.op];
    } else if (currentMicrocode.m5 === 3) {
      this.controlAddressRegister = this.controlRomB[(currentMicrocode.sr2 << 3) | ((currentMicrocode.sr2 ? currentInstruction.s : currentMicrocode.sr1) << 2) | currentInstruction.m];
    }
    
    const resolvedSourceB = currentMicrocode.mrb ? currentMicrocode.rb : (currentMicrocode.m2 ? currentInstruction.ir2 : currentInstruction.ir1);
    const resolvedDestA = currentMicrocode.mad ? currentMicrocode.rad : ((currentMicrocode.m2 ^ currentInstruction.s) && (currentInstruction.op & 0x20) ? currentInstruction.ir2 : currentInstruction.ir1);
    
    let busA, busB;
    if (!currentMicrocode.f && currentMicrocode.ma) {
      busA = this.hardwareRegisters[resolvedSourceB];
    } else {
      busA = this.hardwareRegisters[resolvedDestA];
    }
    
    if (currentMicrocode.mb) {
      busB = this.instructionRegister;
    } else {
      busB = this.hardwareRegisters[resolvedSourceB];
    }
    
    const computedAluData = this.executeArithmeticLogicUnit(busA, busB, currentMicrocode.cula, (this.statusRegister >> 2) & 0x1);
    let multiplexerResult;
    
    switch (currentMicrocode.md) {
      case 0: multiplexerResult = computedAluData.result; break;
      case 1: multiplexerResult = this.fetchFromMemory(busA); break;
      case 2: multiplexerResult = this.statusRegister & 0x1f; break;
      case 3: multiplexerResult = currentMicrocode.const; break;
    }
    
    // Status Register Execution Latch Rules
    if (currentMicrocode.f) {
      if (currentMicrocode.lf) {
        this.statusRegister = busA & 0x1f; 
      }
    } else {
      this.statusRegister = (currentMicrocode.fm & computedAluData.zcno) | (~currentMicrocode.fm & this.statusRegister);
    }
    
    //Lowercase micro-internal flags latch on every clock tick
    this.statusRegister = (this.statusRegister & 0x1f) | ((computedAluData.zcno << 3) & 0x60);
    
    if (!currentMicrocode.f && currentMicrocode.wm) {
      this.commitToMemory(busA, busB);
    }
    if (currentMicrocode.wr && resolvedDestA !== 0) { 
      this.hardwareRegisters[resolvedDestA] = multiplexerResult;
    }
    if (currentMicrocode.f && currentMicrocode.li) {
      this.instructionRegister = this.fetchFromMemory(busA);
      this.decodedInstructionCache = this.decodeInstructionFields(this.instructionRegister);
      this.executedInstructionCounter++;
    }
    
    this.interruptAcknowledgeFlag = (!currentMicrocode.f && currentMicrocode.iak) ? 1 : 0;
    this.cycleCounter++;

    if (this.isDebuggingEnabled) {
      console.debug(`Executing microcode at CAR: ${this.controlAddressRegister}, F: ${currentMicrocode.f}, Result: ${multiplexerResult}, Flags (zcno): ${computedAluData.zcno.toString(2)}`);
    }

    return !!(currentMicrocode.f && currentMicrocode.li);
  }

  clock() {
    return this.executeSingleClockCycle();
  }

  /**
   * Sets external asynchronous hardware interrupt signals.
   */
  triggerInterruptSignal(signalState) {
    this.interruptSignalFlag = signalState & 0x1;
  }

  setIntSignal(i) {
    this.triggerInterruptSignal(i);
  }

  reloadControlRomA() { this.controlRomA = defaultRomA(); }
  reloadControlRomB() { this.controlRomB = defaultRomB(); }
  reloadControlRomC() { this.controlRomC = defaultRomC(); }

}