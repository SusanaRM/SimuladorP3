# P3 CPU Simulator

Web-based emulator and debugger for the P3 instruction set architecture (ISA). Includes an assembler that translates symbolic assembly code into machine code.

## Requirements

- Node.js >= 18.0.0
- npm or yarn

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (opens on http://localhost:8000)
npm start
# OR
npm run dev
```

The dev server serves the static files from `src/`. Access the application in your browser.

## Available Commands

```bash
# Development
git pull origin main    # Update codebase
npm install             # Install/update dependencies
npm start               # Start dev server on port 8000

# Testing
npm test                    # Run all tests once
npm run test:watch          # Watch mode (re-run on file changes)
npm run test:coverage       # Generate coverage report in ./coverage/
```

## Project Structure

```
SimuladorP3/
├── src/                                    # Application source code
│   ├── index.html                          # Entry point / main HTML file
│   ├── app.js                              # Application initialization and global state
│   ├── css/styles.css                      # Stylesheet
│   └── js/         
│       ├── assembler/                      # Assembly language tools
│       │   ├── assembler.js                # Main assembler logic (symbolic → machine code)
│       │   ├── disassembler.js             # Reverse: machine code → symbolic assembly
│       │   ├── syntax-parser.js            # Parse assembly source text into AST
│       │   ├── isa.js                      # P3 Instruction Set Architecture definition
│       │   ├── instruction-encoder.js      # Instruction encoding
│       │   ├── instruction.js              # Instruction representation
│       │   └── consts.js                   # Constants (opcode values, flags, etc.)
│       │           
│       ├── cpu-core/                       # CPU emulation
│       │   ├── cpu.js                      # Main CPU class (registers, ALU, control unit)
│       │   └── registers.js                # Register file implementation
│       │           
│       ├── memory-system/                  # Memory management
│       │   └── memory.js                   # RAM simulation and address mapping
│       │           
│       ├── debugger/                       # Debugging features
│       │   ├── debugger.js                 # Breakpoints, step execution, watch expressions
│       │   └── reference.js                # Memory/register references tracking
│       │           
│       └── ui/ui.js                        # UI components and event handlers
├── tests/                                  # Unit and integration tests
│   ├── cpu.test.js                         # CPU instruction execution tests
│   ├── assembler.test.js                   # Assembly/disassembly correctness tests
│   ├── memory.test.js                      # Memory system tests
│   ├── disassembler.test.js                # Reverse assembly tests
│   ├── reference.test.js                   # Reference CPU/Assembler implementation comparison tests
│   └── example-programs/                   # Test programs in assembly format
│           
├── package.json                            # Dependencies and scripts
├── jest.config.js                          # Jest configuration (transform, coverage paths)
├── babel.config.js                         # Babel transpilation settings
└── .gitignore                              # Git ignore rules
```

## Architecture Overview

**Data Flow:**
1. User writes assembly code in the editor (`src/js/assembler/`)
2. `SyntaxParser` tokenizes and parses source into AST
3. `Assembler` generates machine code bytes (P3 ISA encoding)
4. CPU loads program from memory address 0x0000
5. Debug loop: Fetch → Decode → Execute → Store, with UI updates
6. `Disassembler` can reverse the process for debugging display

**Key Components:**
- **Assembler**: Converts symbolic assembly (e.g., `MOV R1, 55h`) into binary machine code
- **CPU Core**: Emulates P3 architecture (8 general-purpose registers, flags, ALU operations)
- **Memory System**: 2^16 bytes of RAM with addressable locations
- **Debugger UI**: Visualizes registers, memory, and provides step execution controls

## Testing Notes

Tests use Jest with Babel for ES module support. The `transformIgnorePatterns` in `jest.config.js` ensures the external `p3js` library is properly transpiled.

Run specific test files:
```bash
npx jest tests/cpu.test.js
npx jest tests/assembler.test.js --verbose
```
