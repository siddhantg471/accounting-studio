import { db, auth } from '../../backend/firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let currentUserId = null;
let ledgers = [];
let daybook = [];

// Group mappings for financial statements
const groupMapping = {
    "Capital Account": "Capital",
    "Current Assets": "Assets",
    "Current Liabilities": "Liabilities",
    "Direct Expenses": "TradingDr",
    "Direct Incomes": "TradingCr",
    "Indirect Expenses": "PLDr",
    "Indirect Incomes": "PLCr",
    "Fixed Assets": "Assets",
    "Investments": "Assets",
    "Loans (Liability)": "Liabilities",
    "Secured Loans": "Liabilities",
    "Unsecured Loans": "Liabilities",
    "Purchase Accounts": "TradingDr",
    "Sales Accounts": "TradingCr",
    "Sundry Creditors": "Liabilities",
    "Sundry Debtors": "Assets",
    "Cash-in-Hand": "Assets",
    "Bank Accounts": "Assets",
    "Bank OD Accounts": "Liabilities",
    "Branch / Divisions": "Assets",
    "Deposits (Asset)": "Assets",
    "Duties & Taxes": "Liabilities",
    "Expenses (Direct)": "TradingDr",
    "Expenses (Indirect)": "PLDr",
    "Loans & Advances (Asset)": "Assets",
    "Misc. Expenses (Asset)": "Assets",
    "Stock-in-Hand": "Assets",
    "Suspense Account": "Suspense"
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        await loadData();
        generateReports();
    } else {
        currentUserId = null;
        ledgers = [];
        daybook = [];
    }
});

async function loadData() {
    if (!currentUserId) return;
    
    // Fetch Ledgers
    const qLedgers = query(collection(db, "ledgers"), where("userId", "==", currentUserId));
    const ledgerSnap = await getDocs(qLedgers);
    ledgers = [];
    ledgerSnap.forEach(doc => {
        ledgers.push({ id: doc.id, ...doc.data() });
    });

    // Fetch Daybook
    const qDaybook = query(collection(db, "daybook"), where("userId", "==", currentUserId));
    const daybookSnap = await getDocs(qDaybook);
    daybook = [];
    daybookSnap.forEach(doc => {
        daybook.push({ id: doc.id, ...doc.data() });
    });
}

function calculateBalances() {
    // We use a convention: Positive = Debit (Dr), Negative = Credit (Cr)
    
    let balances = {};
    
    // Initialize with opening balances
    ledgers.forEach(l => {
        // We track both the balance and the group
        balances[l.name] = {
            group: l.group,
            balance: parseFloat(l.opBal) || 0
        };
    });

    // We also need an implicit "System Cash/Bank" account to balance single-sided entries
    balances["System Cash/Bank"] = {
        group: "Cash-in-Hand",
        balance: 0
    };

    // Process Daybook entries
    daybook.forEach(entry => {
        const amt = parseFloat(entry.amount) || 0;
        const ledgerName = entry.ledger;
        
        // If ledger doesn't exist in our list (maybe deleted or "Cash"/"Bank" selected directly), create a placeholder
        if (!balances[ledgerName]) {
            balances[ledgerName] = {
                group: (ledgerName === "Cash" || ledgerName === "Bank") ? "Cash-in-Hand" : "Suspense Account",
                balance: 0
            };
        }

        if (entry.type === 'Payment') {
            // Payment: Debit the selected ledger, Credit System Cash/Bank
            balances[ledgerName].balance += amt;
            balances["System Cash/Bank"].balance -= amt;
        } else if (entry.type === 'Receipt') {
            // Receipt: Credit the selected ledger, Debit System Cash/Bank
            balances[ledgerName].balance -= amt;
            balances["System Cash/Bank"].balance += amt;
        } else if (entry.type === 'Contra' || entry.type === 'Journal') {
            // For Journal/Contra, if no other side is specified, we just debit the ledger and credit system cash 
            // as a fallback to maintain trial balance equality.
            balances[ledgerName].balance += amt;
            balances["System Cash/Bank"].balance -= amt;
        }
    });

    return balances;
}

function formatMoney(amount) {
    return Math.abs(amount).toFixed(2);
}

function generateReports() {
    const balances = calculateBalances();
    
    let totalDr = 0;
    let totalCr = 0;
    
    let tradingDr = [];
    let tradingCr = [];
    let plDr = [];
    let plCr = [];
    let assets = [];
    let liabilities = [];
    let capital = [];

    const tbBody = document.getElementById('tb-table-body');
    if (!tbBody) return; // not on reports view
    tbBody.innerHTML = '';

    // Generate Trial Balance
    for (const [accName, data] of Object.entries(balances)) {
        if (Math.abs(data.balance) < 0.01 && accName === "System Cash/Bank") continue; // hide if zero and it's the system account
        
        const isDr = data.balance >= 0;
        const drAmt = isDr ? data.balance : 0;
        const crAmt = isDr ? 0 : Math.abs(data.balance);
        
        totalDr += drAmt;
        totalCr += crAmt;

        // Skip absolute zero balances from TB unless they are actual ledgers user created
        if (Math.abs(data.balance) < 0.01 && accName === "System Cash/Bank") {
            // Do nothing
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${accName}</td>
                <td><span class="badge-category">${data.group}</span></td>
                <td style="text-align: right;">${drAmt > 0 ? formatMoney(drAmt) : '-'}</td>
                <td style="text-align: right;">${crAmt > 0 ? formatMoney(crAmt) : '-'}</td>
            `;
            tbBody.appendChild(tr);
        }

        // Categorize for P&L and Balance Sheet
        const category = groupMapping[data.group] || "Suspense";
        
        const item = { name: accName, amount: Math.abs(data.balance) };
        
        if (category === "TradingDr" && drAmt > 0) tradingDr.push(item);
        if (category === "TradingDr" && crAmt > 0) tradingCr.push(item); // abnormal credit balance in expense
        if (category === "TradingCr" && crAmt > 0) tradingCr.push(item);
        if (category === "TradingCr" && drAmt > 0) tradingDr.push(item); // abnormal debit balance in income
        
        if (category === "PLDr" && drAmt > 0) plDr.push(item);
        if (category === "PLDr" && crAmt > 0) plCr.push(item);
        if (category === "PLCr" && crAmt > 0) plCr.push(item);
        if (category === "PLCr" && drAmt > 0) plDr.push(item);
        
        if (category === "Assets" && drAmt > 0) assets.push(item);
        if (category === "Assets" && crAmt > 0) liabilities.push(item); // abnormal cr in asset is liability (like Bank OD)
        
        if (category === "Liabilities" && crAmt > 0) liabilities.push(item);
        if (category === "Liabilities" && drAmt > 0) assets.push(item); // abnormal dr in liability is asset
        
        if (category === "Capital" && crAmt > 0) capital.push(item);
        if (category === "Capital" && drAmt > 0) capital.push({ name: accName + " (Dr)", amount: -Math.abs(data.balance) }); // subtract from capital
        
        if (category === "Suspense") {
            if (drAmt > 0) assets.push(item);
            if (crAmt > 0) liabilities.push(item);
        }
    }

    document.getElementById('tb-total-dr').textContent = formatMoney(totalDr);
    document.getElementById('tb-total-cr').textContent = formatMoney(totalCr);

    // Calculate Gross Profit
    const sumTradingDr = tradingDr.reduce((sum, item) => sum + item.amount, 0);
    const sumTradingCr = tradingCr.reduce((sum, item) => sum + item.amount, 0);
    const grossProfit = sumTradingCr - sumTradingDr;

    if (grossProfit > 0) {
        tradingDr.push({ name: "Gross Profit c/d", amount: grossProfit, isBold: true });
        plCr.push({ name: "Gross Profit b/d", amount: grossProfit, isBold: true });
    } else if (grossProfit < 0) {
        tradingCr.push({ name: "Gross Loss c/d", amount: Math.abs(grossProfit), isBold: true });
        plDr.push({ name: "Gross Loss b/d", amount: Math.abs(grossProfit), isBold: true });
    }

    // Calculate Net Profit
    const sumPlDr = plDr.reduce((sum, item) => sum + item.amount, 0);
    const sumPlCr = plCr.reduce((sum, item) => sum + item.amount, 0);
    const netProfit = sumPlCr - sumPlDr;

    if (netProfit > 0) {
        plDr.push({ name: "Net Profit (transferred to Capital)", amount: netProfit, isBold: true });
        capital.push({ name: "Net Profit", amount: netProfit });
    } else if (netProfit < 0) {
        plCr.push({ name: "Net Loss (transferred to Capital)", amount: Math.abs(netProfit), isBold: true });
        capital.push({ name: "Net Loss", amount: -Math.abs(netProfit) }); // Negative capital adjustment
    }

    // Render Trading and P&L
    const plDrBody = document.getElementById('pl-dr-body');
    const plCrBody = document.getElementById('pl-cr-body');
    plDrBody.innerHTML = '';
    plCrBody.innerHTML = '';

    const renderRows = (items, tbody) => {
        items.forEach(item => {
            const tr = document.createElement('tr');
            if (item.isBold) tr.style.fontWeight = 'bold';
            tr.innerHTML = `
                <td>${item.name}</td>
                <td style="text-align: right;">${formatMoney(item.amount)}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    // We can show trading items first, then a total line, then PL items. For simplicity, just list them.
    // Trading
    renderRows(tradingDr, plDrBody);
    renderRows(tradingCr, plCrBody);
    // Spacer
    plDrBody.innerHTML += '<tr><td colspan="2" style="border-bottom: 1px solid var(--border);"></td></tr>';
    plCrBody.innerHTML += '<tr><td colspan="2" style="border-bottom: 1px solid var(--border);"></td></tr>';
    // P&L
    renderRows(plDr, plDrBody);
    renderRows(plCr, plCrBody);

    const grandPlDr = sumTradingDr + sumPlDr + (grossProfit > 0 ? grossProfit : 0) + (netProfit > 0 ? netProfit : 0);
    document.getElementById('pl-total-dr').textContent = formatMoney(grandPlDr);
    document.getElementById('pl-total-cr').textContent = formatMoney(grandPlDr); // Should balance

    // Render Balance Sheet
    // Aggregate capital
    const netCapital = capital.reduce((sum, item) => sum + item.amount, 0);
    const finalCapitalItems = [{ name: "Capital A/c", amount: netCapital, isBold: true }];
    
    const bsLiabBody = document.getElementById('bs-liab-body');
    const bsAssetsBody = document.getElementById('bs-assets-body');
    bsLiabBody.innerHTML = '';
    bsAssetsBody.innerHTML = '';

    renderRows(finalCapitalItems, bsLiabBody);
    renderRows(liabilities, bsLiabBody);
    renderRows(assets, bsAssetsBody);

    const totalLiabilities = netCapital + liabilities.reduce((s, i) => s + i.amount, 0);
    const totalAssetsAmt = assets.reduce((s, i) => s + i.amount, 0);

    document.getElementById('bs-total-liab').textContent = formatMoney(totalLiabilities);
    document.getElementById('bs-total-assets').textContent = formatMoney(totalAssetsAmt);
}

// UI Tab Switching for Reports
window.changeReportTab = (tabId) => {
    document.getElementById('report-trial-balance').style.display = 'none';
    document.getElementById('report-pl').style.display = 'none';
    document.getElementById('report-balance-sheet').style.display = 'none';
    
    document.getElementById('report-' + tabId).style.display = 'block';
};

// Auto-refresh reports when navigated to
const originalHashChange = window.onhashchange;
window.addEventListener('hashchange', () => {
    if (window.location.hash === '#reports') {
        loadData().then(generateReports);
    }
});
