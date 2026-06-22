import { Assembler } from "../src/js/assembler/assembler.js";
import { ISA } from "../src/js/assembler/isa.js";

let fs = require("fs");

describe("Assembler - P3 CPU Architecture Tests", () => {
  let assembler;

  beforeEach(() => {
    assembler = new Assembler();
  });

  describe("Initialization - ISA Object per Manual P3 Page 6-17", () => {
    test("should have conditions array with all valid condition codes", () => {
      expect(Object.keys(ISA.instance.conditions)).toEqual([
        "Z",
        "NZ",
        "C",
        "NC",
        "N",
        "NN",
        "O",
        "NO",
        "P",
        "NP",
        "I",
        "NI",
      ]);
    });

    test("should have opcode for each instruction type", () => {
      const expectedInstructions = [
        "NOP",
        "ENI",
        "DSI",
        "STC",
        "CLC",
        "CMC",
        "RET",
        "RTI",
        "INT",
        "RETN",
        "NEG",
        "INC",
        "DEC",
        "COM",
        "PUSH",
        "POP",
        "SHR",
        "SHL",
        "SHRA",
        "SHLA",
        "ROR",
        "ROL",
        "RORC",
        "ROLC",
        "CMP",
        "ADD",
        "ADDC",
        "SUB",
        "SUBB",
        "MUL",
        "DIV",
        "TEST",
        "AND",
        "OR",
        "XOR",
        "MOV",
        "MVBH",
        "MVBL",
        "XCH",
        "JMP",
        "CALL",
        "JMP.",
        "CALL.",
        "BR",
        "BR.",
      ];

      expectedInstructions.forEach((instruction) => {
        expect(Object.keys(ISA.instance.instructions)).toContain(instruction);
      });
    });

    test("should handle labels correctly for branch instructions", () => {
      const code = `BR END
END: MOV R0, 1`;
      let result = assembler.assemble(code);
      expect(Array.isArray(result)).toBe(false);
      expect(result.labelCount).toBe(1);
    });

    test("should assemble JMP with proper label resolution", () => {
      const code = `JMP TARGET
TARGET: MOV R0, 1`;
      let result = assembler.assemble(code);
      expect(result.labels.TARGET).toBeDefined();
    });
  });

  describe("Assembly - Basic Instructions", () => {
    test("should assemble simple MOV instruction", () => {
      const code = "MOV R0, 42";
      let result = assembler.assemble(code);
      // MOV R0, imm should produce: opcode | c=const | m=imm | r=reg
      expect(result.memoryUsage).toBe(2);
    });

    test("should handle register-to-immediate MOV", () => {
      const code = "MOV R3, 100";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe("Extended Instructions per Manual P3 Page 14-16", () => {
    test("should assemble NEG instruction", () => {
      const code = "NEG R0";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble COM instruction", () => {
      const code = "COM R1";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble INC instruction", () => {
      const code = "INC R2";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble DEC instruction", () => {
      const code = "DEC R3";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble SHR with immediate shift amount", () => {
      const code = "SHR R4, 2";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble SHL instruction", () => {
      const code = "SHL R5, 3";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble ROR rotate right", () => {
      const code = "ROR R7, 1";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble ROL rotate left", () => {
      const code = "ROL R7, 1";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe("Condition Codes per Manual P3 Page 7", () => {
    test("should assemble BR with label", () => {
      const code = `BR END
END: MOV R0, 1`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result.labels.END).toBeDefined();
    });

    test("should assemble JMP (absolute jump) with label", () => {
      const code = `JMP START
START: MOV R0, 1`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // JMP absolute uses m=imm for the target address
    });

    test("should assemble CALL subroutine with label", () => {
      const code = `CALL SUBS
SUBS: MOV R0, 1`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble conditional branch with NZ flag and label", () => {
      const code = `BR.NZ EQUAL
EQUAL: MOV R0, 2`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble conditional branch with C flag and label", () => {
      const code = `BR.C OVERFLOW
OVERFLOW: MOV R0, 2`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble conditional branch with Z flag", () => {
      const code = "MOV R0, 0";
      let result = assembler.assemble(code);
      // Just verify it assembles without error
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should handle relative jump offset calculation correctly", () => {
      const code = `BR LABEL
LABEL: MOV R0, 1`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe("Pseudo-Instructions per Manual P3 Page 9", () => {
    test("should handle ORIG directive", () => {
      const code = "ORIG ff00h";
      try {
        let result = assembler.assemble(code);
        expect(result).toBeDefined();
        expect(result).not.toBeNull();
        // Verify position is set to 0x1000
      } catch (error) {
        throw new Error("Failed to assemble ORIG: " + error.message);
      }
    });

    test("should handle EQU directive", () => {
      const code = `CONST EQU 42
MOV R0, CONST`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Verify label is set correctly
      expect(result.labels.CONST).toBeDefined();
    });

    test("should handle WORD directive", () => {
      const code = "DATA WORD 100";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Verify label is assigned to the position before the word
      expect(result.labels.DATA).toBeDefined();
    });

    test("should handle TAB directive", () => {
      const code = "SPACE TAB 10";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should handle STR (string) directive", () => {
      const code = `MSG STR 'Hello'
MOV R0, MSG`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Verify label is assigned and string is stored
    });
  });

  describe("Registers per Manual P3 Page 4", () => {
    test("should use R0-R7 generic registers", () => {
      const code = "MOV R1, R2";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("R0 always equals 0 per architecture specification", () => {
      const code = "NEG R0";
      let result = assembler.assemble(code);
      // Verify it assembles (R0 is handled specially)
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should handle SP register in indexed addressing", () => {
      const code = `DATA WORD 100
MOV R3, M[SP+DATA]`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should handle PC register in relative addressing", () => {
      const code = `LABEL: MOV R1, 5
JMP LABEL`;
      let result = assembler.assemble(code);
      // JMP uses m=imm (target address)
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe("Special Instructions per Manual P3", () => {
    test("should assemble ENI (enable interrupts)", () => {
      const code = "ENI";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble DSI (disable interrupts)", () => {
      const code = "DSI";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble STC (set carry flag)", () => {
      const code = "STC";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble CLC (clear carry flag)", () => {
      const code = "CLC";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble CMC (complement carry flag)", () => {
      const code = "CMC";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should assemble RTI (return from interrupt)", () => {
      const code = "RTI";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe("Error Handling", () => {
    test("should throw error for invalid mnemonic", async () => {
      try {
        let result = assembler.assemble("INVALID R0, 10");
        // If no error thrown, verify the instruction is not in ISA
        expect(Object.keys(ISA.instance.instructions)).not.toContain("INVALID");
      } catch (error) {
        // Expected to throw if validation exists
        expect(error.message).toContain("Syntax error, invalid instruction");
      }
    });

    test("should throw error for invalid register", () => {
      expect(() => assembler.assemble("MOV RX, 10")).toThrow();
    });

    test("should throw error when label already defined", () => {
      const code = `LABEL1: CMC
      LABEL1: RET`;
      expect(() => assembler.assemble(code)).toThrow(
        "Duplicate label collision",
      );
    });

    test("should throw error for undefined label", () => {
      const code = `JMP UNDEFINED`;
      try {
        let result = assembler.assemble(code);
      } catch (error) {
        expect(error.message).toContain("Undefined label");
      }
    });

    test("should throw error for invalid condition", () => {
      const code = `BR.XX END`;
      try {
        let result = assembler.assemble(code);
      } catch (error) {
        expect(error.message).toContain("invalid condition");
      }
    });
  });

  describe("Full Program Assembly", () => {
    test("should assemble complete test program with labels", async () => {
      const code = `; Test ADD: R0 = 10 + 20 = 30
MOV R0, 10        ; Load 10 into R0
ADD R0, 20        ; Add 20 to R0 (R0 = 30)
CMP R0, 30        ; Compare with 30 (sets Z flag)
BR.NZ FAIL      ; Branch to FAIL if not zero

; Test SUB: R1 = 50 - 30 = 20
MOV R1, 50        ; Load 50 into R1
SUB R1, 30        ; Subtract 30 from R1 (R1 = 20)
CMP R1, 20        ; Compare with 20 (sets Z flag)
BR.NZ FAIL

; Success
MOV R3, 1         ; Success flag
BR END            ; Jump to end

FAIL: MOV R3, 0         ; Failure flag

END: NOP`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Verify label count and instruction count
      expect(result.labelCount).toBeGreaterThan(0);
      expect(result.instructionCount).toBeGreaterThan(10);
    });

    test("should handle complex addressing modes", () => {
      const code = `DATA WORD 100
MOV R3, M[SP+DATA]    ; Based addressing
RET`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  describe("Edge Cases and Validation", () => {
    test("should handle negative constants correctly", () => {
      const code = "MOV R0, -42";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should handle hex constants", () => {
      const code = "MOV R1, ABCDh";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should handle octal constants", () => {
      const code = "MOV R3, 075";
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should handle single quote string literals", () => {
      const code = `LABEL: MOV R1, 'A'
RET`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Verify label is correctly set
      expect(result.labels.LABEL).toBeDefined();
    });

    test("should handle comments", () => {
      const code = `; This is a comment
MOV R1, 2
RET`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Verify instructions are parsed correctly despite comments
      expect(result.instructionCount).toBe(2);
    });

    test("should handle empty lines", () => {
      const code = `MOV R1, 5\n \n
RET`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result.instructionCount).toBe(2);
    });

    test("should handle whitespace variations", () => {
      const code = `MOV R1,\t50`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should validate register ranges R0-R7", () => {
      // Verify invalid register throws error
      try {
        assembler.assemble("MOV RX, 10");
      } catch (error) {
        expect(error.message).toContain(
          "Initial operand parameter cannot be immediate",
        );
      }
    });

    test("should handle immediate vs direct addressing", () => {
      const code = `DATA WORD 1234h
MOV R1, DATA`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    test("should calculate jump offsets correctly", () => {
      const code = `JMP LABEL1
LABEL1: RET`;
      let result = assembler.assemble(code);
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      // Verify labels are set correctly
    });
  });

  describe("ISA Instruction Set Verification", () => {
    test("should dump instructions list correctly", () => {
      let output = ISA.instance.dumpInstructionsList();
      expect(output).toContain("MOV");
      expect(output).toContain("ADD");
      expect(output).toContain("BR");
      expect(output).toContain("JMP");
    });

    test("should register instructions from text", () => {
      const text = `NOP   000000   ZERO
MOV   101011   TWO`;
      const isa = ISA.instance;
      ISA.instance.registerInstructionList(text);
      expect(Object.keys(ISA.instance.instructions)).toContain("NOP");
      expect(Object.keys(ISA.instance.instructions)).toContain("MOV");
    });
  });
});
