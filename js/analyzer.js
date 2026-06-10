// analyzer.js

// Simple ambient glow follow mouse effect (reused from dashboard)
document.addEventListener('mousemove', (e) => {
    const glow1 = document.querySelector('.glow-1');
    const glow2 = document.querySelector('.glow-2');
    
    if(glow1 && glow2) {
        const x1 = e.clientX * 0.05;
        const y1 = e.clientY * 0.05;
        const x2 = -e.clientX * 0.03;
        const y2 = -e.clientY * 0.03;
        
        glow1.style.transform = `translate(${x1}px, ${y1}px)`;
        glow2.style.transform = `translate(${x2}px, ${y2}px)`;
    }
});

// State
let rawData = [];
let processedTransactions = [];
let chartInstance = null;
let currentSort = { column: 'date', direction: 'desc' };

// DOM Elements
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('csv-file');
const dashboardArea = document.getElementById('dashboard-area');
const resetBtn = document.getElementById('reset-data');

const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const netBalanceEl = document.getElementById('net-balance');

const searchInput = document.getElementById('search-input');
const filterType = document.getElementById('filter-type');
const tableBody = document.getElementById('table-body');
const tableHeaders = document.querySelectorAll('th[data-sort]');

// --- CATEGORIZATION ENGINE ---
const categoryRules = [
    { category: 'Food & Dining', keywords: ['zomato', 'swiggy', 'restaurant', 'cafe', 'starbucks', 'mcdonalds', 'kfc'] },
    { category: 'Transportation', keywords: ['uber', 'ola', 'irctc', 'fuel', 'petrol', 'makemytrip', 'metro'] },
    { category: 'Utilities', keywords: ['electricity', 'water', 'internet', 'airtel', 'jio', 'recharge', 'bill desk'] },
    { category: 'Shopping', keywords: ['amazon', 'flipkart', 'myntra', 'retail', 'supermarket', 'dmart'] },
    { category: 'Salary/Income', keywords: ['salary', 'neft', 'rtgs', 'interest', 'dividend'] },
    { category: 'ATM/Cash', keywords: ['atm', 'cash withdrawal'] },
    { category: 'UPI Transfer', keywords: ['upi', 'paytm', 'phonepe', 'gpay'] },
];

function categorizeTransaction(description, isIncome) {
    if (!description) return 'Other';
    const lowerDesc = description.toLowerCase();
    
    for (const rule of categoryRules) {
        if (rule.keywords.some(kw => lowerDesc.includes(kw))) {
            return rule.category;
        }
    }
    
    return isIncome ? 'Other Income' : 'Other Expenses';
}

// --- FILE UPLOAD HANDLING ---
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

resetBtn.addEventListener('click', () => {
    dashboardArea.style.display = 'none';
    uploadZone.style.display = 'block';
    fileInput.value = '';
});

function showDashboard() {
    uploadZone.style.display = 'none';
    dashboardArea.style.display = 'block';
}

function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                console.log("Parsed CSV:", results.data);
                processData(results.data);
                showDashboard();
            },
            error: function(err) {
                console.error("Parse Error:", err);
                alert('Error parsing CSV file.');
            }
        });
    } else if (ext === 'xlsx' || ext === 'xls') {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.SheetNames[0];
                const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
                console.log("Parsed Excel:", sheetData);
                processData(sheetData);
                showDashboard();
            } catch (err) {
                console.error("Excel Parse Error:", err);
                alert("Error parsing Excel file.");
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (ext === 'pdf') {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + "\n";
                }
                parseTextToData(fullText);
            } catch (err) {
                console.error("PDF Parse Error:", err);
                alert("Error parsing PDF file.");
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (ext === 'docx') {
        const reader = new FileReader();
        reader.onload = function(e) {
            mammoth.extractRawText({arrayBuffer: e.target.result})
                .then(function(result) {
                    parseTextToData(result.value);
                })
                .catch(function(err) {
                    console.error("DOCX Parse Error:", err);
                    alert("Error parsing Word document.");
                });
        };
        reader.readAsArrayBuffer(file);
    } else {
        alert('Unsupported file type. Please upload CSV, Excel, PDF, or Word document.');
    }
}

function parseTextToData(text) {
    const lines = text.split('\n');
    let parsedData = [];
    
    // Very basic heuristic for text-based tables:
    // e.g., "12/05/2023 Amazon Purchase 500.00 Cr"
    const regex = /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Cr|Dr|Cr\.|Dr\.)?/i;
    
    lines.forEach(line => {
        const match = line.match(regex);
        if (match) {
            let row = {
                'Date': match[1],
                'Description': match[2].trim(),
                'Amount': match[3]
            };
            if (match[4]) {
                row['Amount'] += ' ' + match[4]; // append Cr/Dr to let processData handle it
            }
            parsedData.push(row);
        }
    });

    if (parsedData.length === 0) {
        alert("Could not reliably extract tabular data from this document. Please ensure it contains standard transaction formats, or try exporting it to CSV/Excel first.");
        return;
    }
    
    console.log("Parsed Text Data:", parsedData);
    processData(parsedData);
    showDashboard();
}

// --- DATA PROCESSING ---
function processData(data) {
    processedTransactions = [];
    
    // We try to guess the column names as banks use different headers
    // Common Date columns: Date, Value Date, Transaction Date
    // Common Desc columns: Description, Narration, Particulars
    // Common Amount columns: Debit, Credit, Amount, Withdrawal, Deposit

    if (data.length === 0) return;
    
    const origHeaders = Object.keys(data[0]);
    
    const dateCol = origHeaders.find(h => h.trim().toLowerCase().includes('date')) || origHeaders[0];
    const descCol = origHeaders.find(h => ['description', 'narration', 'particulars'].some(kw => h.trim().toLowerCase().includes(kw))) || origHeaders[1];
    
    const debitCol = origHeaders.find(h => ['debit', 'withdrawal', 'paid out'].some(kw => h.trim().toLowerCase().includes(kw)));
    const creditCol = origHeaders.find(h => ['credit', 'deposit', 'paid in'].some(kw => h.trim().toLowerCase().includes(kw)));
    const amountCol = origHeaders.find(h => h.trim().toLowerCase().includes('amount'));

    const parseNumberAndSign = (val) => {
        if (val === undefined || val === null) return { num: 0, hasCr: false, hasDr: false, isNeg: false };
        let strVal = String(val).trim();
        if (strVal === '') return { num: 0, hasCr: false, hasDr: false, isNeg: false };
        
        const hasCr = /cr\.?$/i.test(strVal) || /credit/i.test(strVal);
        const hasDr = /dr\.?$/i.test(strVal) || /debit/i.test(strVal);
        const isNeg = /^\s*-/.test(strVal);
        
        strVal = strVal.replace(/,/g, '').replace(/^[^\d.-]+/, '');
        const parsed = parseFloat(strVal);
        
        return { 
            num: isNaN(parsed) ? 0 : Math.abs(parsed), 
            hasCr, 
            hasDr, 
            isNeg
        };
    };

    data.forEach(row => {
        let date = String(row[dateCol] || '').trim();
        // Skip empty rows or summary rows that don't have a valid date
        if (!date) return;
        
        let description = String(row[descCol] || '').trim();
        let amount = 0;
        let isIncome = false;

        let rowHasCr = false;
        let rowHasDr = false;
        for (let key in row) {
            let v = String(row[key] || '').trim().toLowerCase();
            if (['cr', 'cr.', 'credit', 'c', 'income'].includes(v)) rowHasCr = true;
            if (['dr', 'dr.', 'debit', 'd', 'expense'].includes(v)) rowHasDr = true;
        }

        let debitData = debitCol ? parseNumberAndSign(row[debitCol]) : {num: 0};
        let creditData = creditCol ? parseNumberAndSign(row[creditCol]) : {num: 0};
        let amountData = amountCol ? parseNumberAndSign(row[amountCol]) : {num: 0};

        if (debitCol && debitCol === creditCol) {
            if (debitData.num > 0) {
                amount = debitData.num;
                if (rowHasCr || debitData.hasCr) isIncome = true;
                else if (rowHasDr || debitData.hasDr || debitData.isNeg) isIncome = false;
                else isIncome = false; 
            }
        } else {
            if (debitData.num > 0) {
                amount = debitData.num;
                isIncome = false;
            } else if (creditData.num > 0) {
                amount = creditData.num;
                isIncome = true;
            } else if (amountData.num > 0) {
                amount = amountData.num;
                if (rowHasCr || amountData.hasCr) isIncome = true;
                else if (rowHasDr || amountData.hasDr || amountData.isNeg) isIncome = false;
                else isIncome = true; 
            } else {
                for(let key in row) {
                    if (key !== dateCol && key !== descCol) {
                        let data = parseNumberAndSign(row[key]);
                        if (data.num > 0) {
                            amount = data.num;
                            if (rowHasCr || data.hasCr) isIncome = true;
                            else if (rowHasDr || data.hasDr || data.isNeg) isIncome = false;
                            else isIncome = false; 
                            break;
                        }
                    }
                }
            }
        }

        if (date && amount > 0) {
            processedTransactions.push({
                date: date,
                timestamp: parseDateToTimestamp(date),
                description: description,
                category: categorizeTransaction(description, isIncome),
                amount: amount,
                isIncome: isIncome
            });
        }
    });

    // Initial Sort by Date desc
    processedTransactions.sort((a, b) => b.timestamp - a.timestamp);
    
    updateDashboard();
    renderTable();
}

function parseDateToTimestamp(dateStr) {
    // Attempt to handle DD/MM/YYYY vs MM/DD/YYYY based on basic checks
    // If it fails, rely on JS Date
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
        // Assume DD/MM/YYYY if parts[0] > 12
        if (parseInt(parts[0]) > 12) {
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
        }
    }
    return new Date(dateStr).getTime() || 0;
}

// --- RENDERING ---
function updateDashboard() {
    let income = 0;
    let expense = 0;
    let categoryTotals = {};

    processedTransactions.forEach(t => {
        if (t.isIncome) {
            income += t.amount;
        } else {
            expense += t.amount;
            categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
        }
    });

    totalIncomeEl.textContent = `₹${income.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    totalExpenseEl.textContent = `₹${expense.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    
    const net = income - expense;
    netBalanceEl.textContent = `₹${Math.abs(net).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
    netBalanceEl.style.color = net >= 0 ? 'var(--success, #22c55e)' : 'var(--danger, #ef4444)';

    renderChart({ income, expense, net });
}

function renderChart(financials) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    const { income, expense, net } = financials;

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const borderColor = isDark ? '#1e293b' : '#ffffff';

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Total Income', 'Total Expenses', 'Net Balance'],
            datasets: [{
                label: 'Amount (₹)',
                data: [income, expense, net],
                backgroundColor: [
                    '#22c55e', // Green for income
                    '#ef4444', // Red for expense
                    net >= 0 ? '#3b82f6' : '#f97316' // Blue for positive net, orange for negative
                ],
                borderWidth: 1,
                borderColor: borderColor,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Outfit', size: 14, weight: '600' },
                    bodyFont: { family: 'Outfit', size: 14 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: textColor,
                        font: { family: 'Outfit' }
                    },
                    grid: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                },
                x: {
                    ticks: {
                        color: textColor,
                        font: { family: 'Outfit', weight: '600' }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}


function renderTable() {
    const searchTerm = searchInput.value.toLowerCase();
    const filter = filterType.value;

    let filtered = processedTransactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm) || t.category.toLowerCase().includes(searchTerm);
        let matchesFilter = true;
        if (filter === 'income') matchesFilter = t.isIncome;
        if (filter === 'expense') matchesFilter = !t.isIncome;
        
        return matchesSearch && matchesFilter;
    });

    // Apply sorting
    filtered.sort((a, b) => {
        let valA, valB;
        if (currentSort.column === 'date') { valA = a.timestamp; valB = b.timestamp; }
        else if (currentSort.column === 'amount') { valA = a.amount; valB = b.amount; }
        else if (currentSort.column === 'category') { valA = a.category; valB = b.category; }
        else { valA = a.description; valB = b.description; }

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    tableBody.innerHTML = '';

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No transactions found.</td></tr>`;
        return;
    }

    filtered.forEach(t => {
        const tr = document.createElement('tr');
        
        const dateTd = document.createElement('td');
        dateTd.textContent = t.date;
        
        const descTd = document.createElement('td');
        descTd.textContent = t.description;
        
        const catTd = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge-category';
        badge.textContent = t.category;
        catTd.appendChild(badge);
        
        const amtTd = document.createElement('td');
        amtTd.style.textAlign = 'right';
        amtTd.className = `amount ${t.isIncome ? 'positive' : 'negative'}`;
        amtTd.textContent = `${t.isIncome ? '+' : '-'} ₹${t.amount.toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

        tr.appendChild(dateTd);
        tr.appendChild(descTd);
        tr.appendChild(catTd);
        tr.appendChild(amtTd);
        tableBody.appendChild(tr);
    });
}

// --- EVENT LISTENERS ---
searchInput.addEventListener('input', renderTable);
filterType.addEventListener('change', renderTable);

tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
        const column = th.dataset.sort;
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }
        
        // Update visual arrows
        tableHeaders.forEach(h => {
            h.textContent = h.textContent.replace(' ↑', '').replace(' ↓', '').replace(' ↕', '') + ' ↕';
        });
        th.textContent = th.textContent.replace(' ↕', '') + (currentSort.direction === 'asc' ? ' ↑' : ' ↓');
        
        renderTable();
    });
});

window.addEventListener('themechange', () => {
    updateDashboard();
});

// --- EXPORT FUNCTIONALITY ---
window.exportData = function(type) {
    // Hide dropdown
    document.getElementById('export-dropdown').classList.remove('show');

    if (processedTransactions.length === 0) {
        alert("No data available to export. Please upload a file first.");
        return;
    }

    const searchTerm = searchInput.value.toLowerCase();
    const filter = filterType.value;
    
    // Get currently visible data
    let dataToExport = processedTransactions.filter(t => {
        const matchesSearch = t.description.toLowerCase().includes(searchTerm) || t.category.toLowerCase().includes(searchTerm);
        let matchesFilter = true;
        if (filter === 'income') matchesFilter = t.isIncome;
        if (filter === 'expense') matchesFilter = !t.isIncome;
        return matchesSearch && matchesFilter;
    });

    dataToExport.sort((a, b) => {
        let valA, valB;
        if (currentSort.column === 'date') { valA = a.timestamp; valB = b.timestamp; }
        else if (currentSort.column === 'amount') { valA = a.amount; valB = b.amount; }
        else if (currentSort.column === 'category') { valA = a.category; valB = b.category; }
        else { valA = a.description; valB = b.description; }

        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const exportHeaders = ["Date", "Description", "Category", "Amount (INR)", "Type"];
    
    let totalIncome = 0;
    let totalExpense = 0;
    
    const exportRows = dataToExport.map(t => {
        if (t.isIncome) totalIncome += t.amount;
        else totalExpense += t.amount;
        
        return [
            t.date,
            t.description,
            t.category,
            t.amount.toFixed(2),
            t.isIncome ? 'Income' : 'Expense'
        ];
    });

    const netBalance = totalIncome - totalExpense;

    exportRows.push(["", "", "", "", ""]);
    exportRows.push(["", "", "TOTAL INCOME", totalIncome.toFixed(2), ""]);
    exportRows.push(["", "", "TOTAL EXPENSES", totalExpense.toFixed(2), ""]);
    exportRows.push(["", "", "NET BALANCE", Math.abs(netBalance).toFixed(2), netBalance >= 0 ? "Surplus" : "Deficit"]);

    if (type === 'excel') {
        const wsData = [exportHeaders, ...exportRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "3B82F6" } },
            alignment: { horizontal: "center", vertical: "center" }
        };
        
        const summaryStyle = {
            font: { bold: true, color: { rgb: "0F172A" } },
            fill: { fgColor: { rgb: "F1F5F9" } },
            alignment: { horizontal: "right" }
        };

        const titleStyle = {
            font: { bold: true, color: { rgb: "0F172A" } },
            alignment: { horizontal: "right" }
        };

        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellRef = XLSX.utils.encode_cell({c: C, r: 0});
            if (ws[cellRef]) ws[cellRef].s = headerStyle;
        }

        const rowCount = range.e.r;
        for (let R = rowCount - 2; R <= rowCount; ++R) {
            for (let C = 2; C <= 4; ++C) { 
                const cellRef = XLSX.utils.encode_cell({c: C, r: R});
                if (ws[cellRef]) {
                    if (C === 2) ws[cellRef].s = titleStyle;
                    else ws[cellRef].s = summaryStyle;
                }
            }
        }

        ws['!cols'] = [
            { wch: 15 },
            { wch: 50 },
            { wch: 25 },
            { wch: 18 },
            { wch: 15 } 
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, "Statement_Analysis.xlsx");
    } else if (type === 'pdf') {
        const doc = new window.jspdf.jsPDF();
        doc.text("Statement Analysis", 14, 15);
        
        doc.autoTable({
            head: [exportHeaders],
            body: exportRows,
            startY: 20,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [59, 130, 246] }
        });
        
        doc.save("Statement_Analysis.pdf");
    } else if (type === 'doc') {
        let tableHtml = '<table border="1" style="border-collapse: collapse; width: 100%; font-family: sans-serif;"><thead><tr>';
        exportHeaders.forEach(h => { tableHtml += `<th style="background-color: #f3f4f6; padding: 8px; text-align: left;">${h}</th>`; });
        tableHtml += '</tr></thead><tbody>';
        exportRows.forEach(row => {
            tableHtml += '<tr>';
            row.forEach(cell => { tableHtml += `<td style="padding: 8px;">${cell}</td>`; });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';

        const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Statement Analysis</title></head><body>";
        const footer = "</body></html>";
        const sourceHTML = header + "<h2 style='font-family: sans-serif;'>Statement Analysis</h2>" + tableHtml + footer;
        
        const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = url;
        fileDownload.download = 'Statement_Analysis.doc';
        fileDownload.click();
        document.body.removeChild(fileDownload);
    } else if (type === 'csv') {
        const csvContent = exportRows.map(e => e.map(cell => {
            let str = String(cell);
            // escape quotes and wrap in quotes if contains comma
            if (str.includes(',') || str.includes('"')) {
                str = `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        }).join(",")).join("\n");
        const blob = new Blob([exportHeaders.join(",") + "\n" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const fileDownload = document.createElement("a");
        fileDownload.setAttribute("href", url);
        fileDownload.setAttribute("download", "Statement_Analysis.csv");
        document.body.appendChild(fileDownload);
        fileDownload.click();
        document.body.removeChild(fileDownload);
    }
};

// Close export dropdown when clicking outside
document.addEventListener('click', (e) => {
    const exportMenuContainer = document.getElementById('export-menu-container');
    const dropdown = document.getElementById('export-dropdown');
    if (exportMenuContainer && dropdown && !exportMenuContainer.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});
