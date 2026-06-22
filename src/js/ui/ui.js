// UI Components - Basic editor interface
import { CPU } from '../cpu-core/cpu.js';

export function createEditor() {
    const editor = document.createElement('div');
    editor.id = 'assembly-editor';
    editor.contentEditable = true;
    editor.style.width = '100%';
    editor.style.height = '300px';
    editor.style.fontSize = '14px';
    editor.style.border = '1px solid #ccc';
    editor.style.padding = '10px';
    editor.style.fontFamily = 'monospace';
    editor.style.whiteSpace = 'pre';
    return editor;
}

export function createRegisterDisplay(cpu) {
    const display = document.createElement('div');
    display.id = 'register-display';
    display.style.marginTop = '20px';
    display.style.padding = '15px';
    display.style.border = '1px solid #ccc';
    display.style.borderRadius = '5px';
    display.style.backgroundColor = '#f9f9f9';

    // Create table for registers
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    // Header
    const headerRow = document.createElement('tr');
    ['Register', 'Value (Hex)', 'Value (Dec)', 'Description'].forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.style.padding = '8px';
        th.style.border = '1px solid #ddd';
        th.style.backgroundColor = '#e0e0e0';
        th.style.textAlign = 'left';
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Register rows
    const registers = [
        { name: 'R0', desc: 'General Purpose' },
        { name: 'R1', desc: 'General Purpose' },
        { name: 'R2', desc: 'General Purpose' },
        { name: 'R3', desc: 'General Purpose' },
        { name: 'R4', desc: 'General Purpose' },
        { name: 'R5', desc: 'General Purpose' },
        { name: 'R6', desc: 'General Purpose' },
        { name: 'R7', desc: 'General Purpose' },
        { name: 'PC', desc: 'Program Counter' },
        { name: 'SP', desc: 'Stack Pointer' },
        { name: 'RE', desc: 'Return Address' }
    ];

    registers.forEach(reg => {
        const row = document.createElement('tr');
        
        // Register name
        const nameCell = document.createElement('td');
        nameCell.textContent = reg.name;
        nameCell.style.padding = '8px';
        nameCell.style.border = '1px solid #ddd';
        nameCell.style.fontWeight = 'bold';
        row.appendChild(nameCell);
        
        // Hex value
        const hexCell = document.createElement('td');
        hexCell.textContent = '0x0000';
        hexCell.style.padding = '8px';
        hexCell.style.border = '1px solid #ddd';
        hexCell.style.fontFamily = 'monospace';
        row.appendChild(hexCell);
        
        // Decimal value
        const decCell = document.createElement('td');
        decCell.textContent = '0';
        decCell.style.padding = '8px';
        decCell.style.border = '1px solid #ddd';
        row.appendChild(decCell);
        
        // Description
        const descCell = document.createElement('td');
        descCell.textContent = reg.desc;
        descCell.style.padding = '8px';
        descCell.style.border = '1px solid #ddd';
        row.appendChild(descCell);
        
        table.appendChild(row);
    });

    display.appendChild(table);

    // Flags display
    const flagsDiv = document.createElement('div');
    flagsDiv.style.marginTop = '15px';
    flagsDiv.innerHTML = '<strong>Flags:</strong> <span id="flags-display">Z=0 C=0 N=0 O=0 E=0</span>';
    display.appendChild(flagsDiv);

    // Store reference to flags display element
    const flagsDisplay = flagsDiv.querySelector('#flags-display');

    // Update function
    display.updateDisplay = function() {
        registers.forEach((reg, index) => {
            const row = table.rows[index + 1]; // +1 for header
            const value = cpu.registers[reg.name];
            row.cells[1].textContent = '0x' + value.toString(16).toUpperCase().padStart(4, '0');
            row.cells[2].textContent = value.toString();
        });
        
        const flags = cpu.flags;
        flagsDisplay.textContent = 
            `Z=${flags.Z ? 1 : 0} C=${flags.C ? 1 : 0} N=${flags.N ? 1 : 0} O=${flags.O ? 1 : 0} E=${flags.E ? 1 : 0}`;
    };

    return display;
}

export function createControlPanel() {
    const panel = document.createElement('div');
    panel.id = 'control-panel';
    panel.style.marginBottom = '20px';
    panel.style.padding = '15px';
    panel.style.border = '1px solid #ccc';
    panel.style.borderRadius = '5px';
    panel.style.backgroundColor = '#f0f0f0';

    const title = document.createElement('h3');
    title.textContent = 'Simulator Controls';
    title.style.marginTop = '0';
    panel.appendChild(title);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.flexWrap = 'wrap';

    // Assemble button
    const assembleBtn = document.createElement('button');
    assembleBtn.textContent = 'Assemble';
    assembleBtn.id = 'assemble-btn';
    assembleBtn.style.padding = '8px 16px';
    assembleBtn.style.backgroundColor = '#4CAF50';
    assembleBtn.style.color = 'white';
    assembleBtn.style.border = 'none';
    assembleBtn.style.borderRadius = '4px';
    assembleBtn.style.cursor = 'pointer';
    buttonContainer.appendChild(assembleBtn);

    // Step button
    const stepBtn = document.createElement('button');
    stepBtn.textContent = 'Step';
    stepBtn.id = 'step-btn';
    stepBtn.style.padding = '8px 16px';
    stepBtn.style.backgroundColor = '#2196F3';
    stepBtn.style.color = 'white';
    stepBtn.style.border = 'none';
    stepBtn.style.borderRadius = '4px';
    stepBtn.style.cursor = 'pointer';
    stepBtn.disabled = true;
    buttonContainer.appendChild(stepBtn);

    // Run button
    const runBtn = document.createElement('button');
    runBtn.textContent = 'Run';
    runBtn.id = 'run-btn';
    runBtn.style.padding = '8px 16px';
    runBtn.style.backgroundColor = '#FF9800';
    runBtn.style.color = 'white';
    runBtn.style.border = 'none';
    runBtn.style.borderRadius = '4px';
    runBtn.style.cursor = 'pointer';
    runBtn.disabled = true;
    buttonContainer.appendChild(runBtn);

    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.id = 'reset-btn';
    resetBtn.style.padding = '8px 16px';
    resetBtn.style.backgroundColor = '#f44336';
    resetBtn.style.color = 'white';
    resetBtn.style.border = 'none';
    resetBtn.style.borderRadius = '4px';
    resetBtn.style.cursor = 'pointer';
    buttonContainer.appendChild(resetBtn);

    panel.appendChild(buttonContainer);

    // Status display
    const statusDiv = document.createElement('div');
    statusDiv.id = 'status-display';
    statusDiv.style.marginTop = '10px';
    statusDiv.style.padding = '8px';
    statusDiv.style.backgroundColor = '#e8f5e8';
    statusDiv.style.borderRadius = '4px';
    statusDiv.textContent = 'Ready to assemble code';
    panel.appendChild(statusDiv);

    return panel;
}

export function createMemoryViewer(memory) {
    const viewer = document.createElement('div');
    viewer.id = 'memory-viewer';
    viewer.style.marginTop = '20px';
    viewer.style.padding = '15px';
    viewer.style.border = '1px solid #ccc';
    viewer.style.borderRadius = '5px';
    viewer.style.backgroundColor = '#f9f9f9';

    const title = document.createElement('h3');
    title.textContent = 'Memory Viewer (First 32 words)';
    title.style.marginTop = '0';
    viewer.appendChild(title);

    // Create memory table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';

    // Header
    const headerRow = document.createElement('tr');
    ['Address', 'Value (Hex)', 'Value (Dec)', 'ASCII'].forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        th.style.padding = '4px';
        th.style.border = '1px solid #ddd';
        th.style.backgroundColor = '#e0e0e0';
        th.style.fontSize = '11px';
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Memory rows (first 32 words)
    for (let i = 0; i < 32; i++) {
        const row = document.createElement('tr');
        
        // Address
        const addrCell = document.createElement('td');
        addrCell.textContent = '0x' + i.toString(16).toUpperCase().padStart(4, '0');
        addrCell.style.padding = '4px';
        addrCell.style.border = '1px solid #ddd';
        addrCell.style.fontFamily = 'monospace';
        addrCell.style.fontSize = '11px';
        row.appendChild(addrCell);
        
        // Hex value
        const hexCell = document.createElement('td');
        hexCell.textContent = '0x0000';
        hexCell.style.padding = '4px';
        hexCell.style.border = '1px solid #ddd';
        hexCell.style.fontFamily = 'monospace';
        hexCell.style.fontSize = '11px';
        row.appendChild(hexCell);
        
        // Decimal value
        const decCell = document.createElement('td');
        decCell.textContent = '0';
        decCell.style.padding = '4px';
        decCell.style.border = '1px solid #ddd';
        decCell.style.fontSize = '11px';
        row.appendChild(decCell);
        
        // ASCII
        const asciiCell = document.createElement('td');
        asciiCell.textContent = '.';
        asciiCell.style.padding = '4px';
        asciiCell.style.border = '1px solid #ddd';
        asciiCell.style.fontFamily = 'monospace';
        asciiCell.style.fontSize = '11px';
        row.appendChild(asciiCell);
        
        table.appendChild(row);
    }

    viewer.appendChild(table);

    // Update function
    viewer.updateDisplay = function() {
        for (let i = 0; i < 32; i++) {
            const row = table.rows[i + 1]; // +1 for header
            const value = memory[i] || 0;
            
            row.cells[1].textContent = '0x' + value.toString(16).toUpperCase().padStart(4, '0');
            row.cells[2].textContent = value.toString();
            
            // ASCII representation (low byte)
            const charCode = value & 0xFF;
            const ascii = (charCode >= 32 && charCode <= 126) ? String.fromCharCode(charCode) : '.';
            row.cells[3].textContent = ascii;
        }
    };

    return viewer;
}