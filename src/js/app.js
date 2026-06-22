// Main application initialization
import { CPU } from './cpu-core/cpu.js';
import { Assembler } from './assembler/assembler.js';
import { Disassembler } from './assembler/disassembler.js';
import { memory } from './memory-system/memory.js';

// Global instances
let cpu;
let assembler;
let disassembler;
let programLength = 0;
let runIntervalId = null;
let isRunning = false;
let statusDisplay = null;
let programStatusDisplay = null;

function initApp() {
    // Initialize CPU, Assembler, and Disassembler
    cpu = new CPU(memory);
    assembler = new Assembler();
    disassembler = new Disassembler();

    // Update displays initially
    updateRegisterDisplay();
    updateMemoryDisplay();
    updateProgramView();
    setClockDisplay();

    // Set up event listeners
    setupEventListeners();
}

function updateRegisterDisplay() {
    const registers = ['R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'PC', 'SP'];
    const format = document.getElementById('register-format').value;

    registers.forEach((regName) => {
        const element = document.getElementById(`reg-${regName}`);
        if (element) {
            const value = cpu.registers[regName];
            element.textContent = formatRegisterValue(value, format);
        }
    });

    // Update flags
    const flags = cpu.flags;
    document.getElementById('flags-display').textContent =
        `Z=${flags.Z ? 1 : 0} C=${flags.C ? 1 : 0} N=${flags.N ? 1 : 0} O=${flags.O ? 1 : 0} E=${flags.E ? 1 : 0}`;
}

function updateProgramView({ highlightCurrent = true, scrollToCurrent = true } = {}) {
    const viewer = document.getElementById('program-viewer-content');
    if (!viewer) return;

    viewer.innerHTML = '';

    if (programLength === 0) {
        const row = document.createElement('div');
        row.className = 'instruction-row';
        row.innerHTML = '<div class="instruction-code">No program loaded.</div>';
        viewer.appendChild(row);
        return;
    }

    const codeWords = Array.from(memory.slice(0, programLength));
    const instructions = disassembler.disassemble(codeWords);
    const currentPC = cpu.registers.PC;

    let currentInstructionRow;

    instructions.forEach((instruction) => {
        if (instruction.inst == '') return;
        const row = document.createElement('div');
        row.className = 'instruction-row';
        if (highlightCurrent && instruction.addr <= currentPC) {
            currentInstructionRow = row;
        }

        row.innerHTML = `
            <div class="instruction-addr">0x${instruction.addr.toString(16).toUpperCase().padStart(4, '0')}</div>
            <div class="instruction-code">${instruction.inst}</div>
            <div class="instruction-bytes">${'0x' + (instruction.value.toString(16).toUpperCase().padStart(4, '0'))}</div>
            `;

        viewer.appendChild(row);
    });

    currentInstructionRow?.classList.add('current-pc');

    const currentRow = viewer.querySelector('.instruction-row.current-pc');
    if (scrollToCurrent && currentRow) {
        currentRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function formatRegisterValue(value, format) {
    switch (format) {
        case 'decimal':
            // Handle signed 16-bit values
            const signed = value > 32767 ? value - 65536 : value;
            return signed.toString();
        case 'binary':
            return '0b' + value.toString(2).padStart(16, '0');
        case 'ascii':
            const highByte = (value >> 8) & 0xFF;
            const lowByte = value & 0xFF;
            const highChar = (highByte >= 32 && highByte <= 126) ? String.fromCharCode(highByte) : '.';
            const lowChar = (lowByte >= 32 && lowByte <= 126) ? String.fromCharCode(lowByte) : '.';
            return `'${highChar}${lowChar}' (${value})`;
        default:
            return '0x' + value.toString(16).toUpperCase().padStart(4, '0');
    }
}

function getClockSpeedHz() {
    // Exponential scaling: Hz = 2^((value-1)/3)
    // This gives: 1→1Hz, 10→8Hz, 20→80Hz, 30→800Hz, 40→8000Hz, 50→80000Hz
    const sliderValue = parseInt(document.getElementById('clock-speed').value, 10) || 5;
    const hz = Math.pow(2, (sliderValue - 1) / 3);
    return Math.round(hz);
}

function getClockDelay() {
    const hz = getClockSpeedHz();
    return Math.max(1, Math.round(1000 / hz));
}

function humanizeHz(hz) {
    if (hz === 0) return "0 Hz";
    
    // Define the units
    const units = ["Hz", "kHz", "MHz", "GHz", "THz"];
    
    // Calculate the magnitude (log10 helps determine the index)
    let i = Math.floor(Math.log10(hz) / 3);
    
    // Calculate the value and round to 2 decimal places
    let value = (hz / Math.pow(10, i * 3)).toFixed(2);
    if (hz < 1) {
        value = hz.toFixed(2);
        i = 0;
    }
    
    // Return formatted string, avoiding units out of range
    return `${value} ${units[i] || "Unknown"}`;
}

function setClockDisplay() {
    const hz = getClockSpeedHz();
    document.getElementById('clock-speed-display').textContent = `${humanizeHz(hz)}`;
}

function stopExecution() {
    if (runIntervalId !== null) {
        clearInterval(runIntervalId);
        runIntervalId = null;
    }
    isRunning = false;
    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
        runBtn.textContent = '▶ Run';
    }
}

let cycleCount = 0;
let lastTime = performance.now();
let actualHz = 0;

function updateStats(cyclesExecuted) {
    cycleCount += cyclesExecuted;
    const now = performance.now();
    const elapsed = now - lastTime;

    // Update the speed calculation text once every 100ms for a smooth UI
    if (elapsed >= 100) {
        actualHz = (cycleCount * 1000) / elapsed;
        cycleCount = 0;
        lastTime = now;

        const humanSpeed = humanizeHz(actualHz);
        updateStatus(`Running @ ${humanSpeed}. PC=0x${cpu.registers.PC.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
    }

    // UPDATE UI ONCE PER INTERVAL TICK (Approx 50fps)
    updateProgramView();
    updateRegisterDisplay();
    updateMemoryDisplay();

    return actualHz;
}

function startExecution() {
    if (isRunning) return;
    stopExecution();
    const TICK_RATE_MS = 20;
    
    // Reset trackers
    cycleCount = 0;
    lastTime = performance.now();
    let cycleAccumulator = 0;
    const targetHz = getClockSpeedHz();
    
    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.textContent = '⏹ Stop';
    
    isRunning = true;
    
    runIntervalId = setInterval(() => {
        const frameStart = performance.now();
        // 1. Calculate how many fractional cycles belong in this 20ms tick
        // e.g., At 5 Hz, cyclesPerTick = 5 * 0.02 = 0.1 cycles per tick
        const cyclesPerTick = targetHz * (TICK_RATE_MS / 1000);
        
        // 2. Accumulate the fractional value
        cycleAccumulator += cyclesPerTick;
        
        // 3. Extract the integer number of cycles ready to run right now
        // e.g., floor(0.1) = 0. On the 10th tick, floor(1.0) = 1.
        let cyclesToRun = Math.floor(cycleAccumulator);
        
        // 4. Keep the remainder fraction for the next tick
        cycleAccumulator -= cyclesToRun;
        
        try {
            // Only run the loop if there is at least 1 cycle due
            if (cyclesToRun > 0) {
                for (let i = 0; i < cyclesToRun; i++) {
                    cpu.executeSingleClockCycle();

                    // @TODO: Breakpoints
                    // if (breakpoints.has(cpu.registers.PC)) { stopExecution(); break; }
                    if (performance.now() - frameStart >= TICK_RATE_MS * 4/5) {
                        // Max time reached.
                        console.debug(`Could not keep up! Processed only ${i +1} of ${cyclesToRun} cycles.`)
                        cyclesToRun = i+1;
                        break;
                    }
                }
            }
            
            // Pass cyclesToRun down so we can optimize UI rendering
            updateStats(cyclesToRun);
            
        } catch (error) {
            stopExecution();
            updateStatus(`Execution halted: ${error.message}`, 'error');
        }
    }, TICK_RATE_MS);
}

function updateStatus(message, className) {
    if (statusDisplay && programStatusDisplay) {
        statusDisplay.textContent = message;
        statusDisplay.className = `status ${className}`;
        programStatusDisplay.textContent = message;
        programStatusDisplay.className = `status ${className}`;
    }
}

function renderMemoryRange(container, startAddr, range) {
    container.innerHTML = '';

    const bytesPerRow = 16;
    const totalRows = Math.ceil(range / bytesPerRow);

    for (let row = 0; row < totalRows; row++) {
        const addr = startAddr + (row * bytesPerRow);

        const rowDiv = document.createElement('div');
        rowDiv.className = 'memory-row';

        const addrDiv = document.createElement('div');
        addrDiv.className = 'memory-addr';
        addrDiv.textContent = '0x' + addr.toString(16).toUpperCase().padStart(4, '0');
        rowDiv.appendChild(addrDiv);

        const hexDiv = document.createElement('div');
        hexDiv.className = 'memory-hex-col';
        let hexString = '';
        let asciiString = '';

        for (let col = 0; col < bytesPerRow; col++) {
            const byteAddr = addr + col;
            if (byteAddr >= startAddr + range) break;

            const wordAddr = Math.floor(byteAddr / 2);
            const word = memory.read(wordAddr) || 0;
            const value = (byteAddr % 2 === 0) ? ((word >> 8) & 0xFF) : (word & 0xFF);

            hexString += value.toString(16).toUpperCase().padStart(2, '0') + ' ';
            const charCode = value & 0xFF;
            const ascii = (charCode >= 32 && charCode <= 126) ? String.fromCharCode(charCode) : '.';
            asciiString += ascii;
        }

        hexDiv.textContent = hexString.trim();
        rowDiv.appendChild(hexDiv);

        const asciiDiv = document.createElement('div');
        asciiDiv.className = 'memory-ascii';
        asciiDiv.textContent = asciiString;
        rowDiv.appendChild(asciiDiv);

        container.appendChild(rowDiv);
    }
}

function resetCpuState() {
    stopExecution();
    cpu.reset();
}

function updateMemoryDisplay() {
    const container = document.getElementById('memory-hex-content');
    const offsetInput = document.getElementById('memory-offset');
    const rangeSelect = document.getElementById('memory-range');

    let startAddr = parseInt(offsetInput.value, 16) || 0;
    const range = parseInt(rangeSelect.value) || 512;
    renderMemoryRange(container, startAddr, range);
}

function createMemorySnapshotViewer(startAddr, range, title) {
    const collection = document.getElementById('memory-viewer-collection');
    if (!collection) return;

    const viewerCard = document.createElement('div');
    viewerCard.className = 'memory-static-viewer';

    const header = document.createElement('div');
    header.className = 'memory-static-viewer-header';

    const label = document.createElement('div');
    label.textContent = title;
    header.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => viewerCard.remove());
    header.appendChild(removeBtn);

    viewerCard.appendChild(header);

    const controls = document.createElement('div');
    controls.className = 'memory-static-viewer-controls';

    const offsetLabel = document.createElement('label');
    offsetLabel.className = 'memory-static-control-label';
    offsetLabel.textContent = 'Offset: ';
    const offsetInput = document.createElement('input');
    offsetInput.type = 'text';
    offsetInput.value = '0x' + startAddr.toString(16).toUpperCase().padStart(4, '0');
    offsetInput.size = 6;
    offsetLabel.appendChild(offsetInput);

    const rangeLabel = document.createElement('label');
    rangeLabel.className = 'memory-static-control-label';
    rangeLabel.textContent = 'Range: ';
    const rangeInput = document.createElement('select');
    ['256', '512', '1024'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value === '256' ? '256 bytes (0x100)' : value === '512' ? '512 bytes (0x200)' : '1KB (0x400)';
        if (parseInt(value, 10) === range) option.selected = true;
        rangeInput.appendChild(option);
    });
    rangeLabel.appendChild(rangeInput);

    const presetLabel = document.createElement('label');
    presetLabel.className = 'memory-static-control-label';
    presetLabel.textContent = 'View: ';
    const presetSelect = document.createElement('select');
    const presets = [
        { value: '0x0000', text: 'Program Memory (0x0000)' },
        { value: '0x1000', text: 'Stack Area (0x1000)' },
        { value: '0xFF00', text: 'I/O Devices (0xFF00)' },
        { value: 'custom', text: 'Custom Range' }
    ];
    presets.forEach((preset) => {
        const option = document.createElement('option');
        option.value = preset.value;
        option.textContent = preset.text;
        presetSelect.appendChild(option);
    });
    if (startAddr === 0x0000) {
        presetSelect.value = '0x0000';
    } else if (startAddr === 0x1000) {
        presetSelect.value = '0x1000';
    } else if (startAddr === 0xFF00) {
        presetSelect.value = '0xFF00';
    } else {
        presetSelect.value = 'custom';
    }
    presetLabel.appendChild(presetSelect);

    controls.appendChild(offsetLabel);
    controls.appendChild(rangeLabel);
    controls.appendChild(presetLabel);
    viewerCard.appendChild(controls);

    const viewerContent = document.createElement('div');
    viewerContent.className = 'memory-hex memory-static-hex';
    viewerCard.appendChild(viewerContent);

    const updatePresetState = () => {
        if (presetSelect.value !== 'custom') {
            offsetInput.value = presetSelect.value;
        }
    };

    const render = () => {
        const currentStart = parseInt(offsetInput.value, 16) || 0;
        const currentRange = parseInt(rangeInput.value, 10) || 512;
        const presetName = presetSelect.options[presetSelect.selectedIndex]?.text || 'Custom';
        label.textContent = `Memory viewer: Offset 0x${currentStart.toString(16).toUpperCase().padStart(4, '0')} | ${currentRange} bytes (${presetName})`;
        renderMemoryRange(viewerContent, currentStart, currentRange);
    };

    presetSelect.addEventListener('change', () => {
        updatePresetState();
        render();
    });
    offsetInput.addEventListener('input', () => {
        presetSelect.value = 'custom';
        render();
    });
    rangeInput.addEventListener('change', render);

    render();
    collection.appendChild(viewerCard);
}

function setupEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Initially disable execution buttons
    const stepBtn = document.getElementById('step-btn');
    const runBtn = document.getElementById('run-btn');
    stepBtn.disabled = true;
    runBtn.disabled = true;

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked tab
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');

            // Enable execution buttons when switching to Simulator tab
            if (tabId === 'simulator-tab') {
                // Check if there's code in memory (simple check: if PC is 0 and some memory is non-zero)
                const hasCode = memory.memory.some(value => value !== 0);
                if (hasCode) {
                    stepBtn.disabled = false;
                    runBtn.disabled = false;
                    updateStatus('Ready to execute. Use Step or Run.', 'info');
                }
            }
        });
    });

    const assembleBtn = document.getElementById('assemble-btn');
    const resetBtn = document.getElementById('reset-btn');
    statusDisplay = document.getElementById('status-display');
    programStatusDisplay = document.getElementById('program-status-display');
    const clockSpeedInput = document.getElementById('clock-speed');
    clockSpeedInput.max = 3 * Math.log2(1000000000) + 2;
    clockSpeedInput.value = 1/2 * clockSpeedInput.max;
    setClockDisplay();

    const editor = document.getElementById('editor');

    // Memory viewer controls
    const memoryOffset = document.getElementById('memory-offset');
    const memoryRange = document.getElementById('memory-range');
    const memoryPreset = document.getElementById('memory-preset');
    const addMemoryViewerBtn = document.getElementById('add-memory-viewer');

    // Update memory display when controls change
    memoryOffset.addEventListener('input', updateMemoryDisplay);
    memoryRange.addEventListener('change', updateMemoryDisplay);
    memoryPreset.addEventListener('change', () => {
        if (memoryPreset.value !== 'custom') {
            memoryOffset.value = memoryPreset.value;
            updateMemoryDisplay();
        }
    });

    addMemoryViewerBtn.addEventListener('click', () => {
        const startAddr = parseInt(memoryOffset.value, 16) || 0;
        const range = parseInt(memoryRange.value) || 512;
        const presetText = memoryPreset.options[memoryPreset.selectedIndex].text;
        const title = `Memory viewer: Offset 0x${startAddr.toString(16).toUpperCase().padStart(4, '0')} | ${range} bytes (${presetText})`;
        createMemorySnapshotViewer(startAddr, range, title);
    });

    // Register format selector
    const registerFormat = document.getElementById('register-format');
    registerFormat.addEventListener('change', updateRegisterDisplay);

    assembleBtn.addEventListener('click', () => {
        stopExecution();
        try {
            let code = editor.innerText || editor.textContent;
            // Normalize line endings and clean up the code
            code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const machineCode = assembler.assemble(code);
            console.log('Machine code:', machineCode);

            // Reset memory and CPU state before loading a new ROM
            memory.reset();
            resetCpuState();

            // Load machine code into memory starting at address 0
            memory.load(Array.from(new Uint16Array(machineCode.buffer)))
            programLength = machineCode.usedAddresses.findIndex(x => !x) + 1;

            updateStatus(`ROM flashed with ${machineCode.instructionCount} instructions. Switch to Simulator tab to execute.`, 'success');

            updateRegisterDisplay();
            updateMemoryDisplay();
            updateProgramView();

            // Keep buttons disabled until user switches to Simulator tab
            stepBtn.disabled = true;
            runBtn.disabled = true;

        } catch (error) {
            updateStatus(`Assembly error: ${error.message}`, 'error');
            stepBtn.disabled = true;
            runBtn.disabled = true;
            throw error
        }
    });

    stepBtn.addEventListener('click', () => {
        if (isRunning) {
            stopExecution();
            updateStatus('Execution paused. Stepping one instruction.', 'info');
        }
        try {
            cpu.step();
            updateRegisterDisplay();
            updateMemoryDisplay();
            updateProgramView();
            updateStatus(`Executed instruction at PC=0x${cpu.registers.PC.toString(16).toUpperCase().padStart(4, '0')}`, 'info');
        } catch (error) {
            updateStatus(`Execution error: ${error.message}`, 'error');
        }
    });

    runBtn.addEventListener('click', () => {
        if (isRunning) {
            stopExecution();
            updateStatus('Execution stopped.', 'info');
            return;
        }
        startExecution();
    });

    clockSpeedInput.addEventListener('input', () => {
        setClockDisplay();
        if (isRunning) {
            stopExecution();
            startExecution();
        }
    });

    resetBtn.addEventListener('click', () => {
        resetCpuState();
        updateRegisterDisplay();
        updateMemoryDisplay();
        updateProgramView();
        updateStatus('CPU state reset. ROM preserved.', 'info');
        stepBtn.disabled = false;
        runBtn.disabled = false;
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);