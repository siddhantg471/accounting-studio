import { db, auth } from '../../backend/firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUserId = null;
let invoicesUnsubscribe = null;

// App Protection
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'auth.html';
        if (invoicesUnsubscribe) invoicesUnsubscribe();
    } else {
        currentUserId = user.uid;
        loadDashboardInvoices();
    }
});

function loadDashboardInvoices() {
    const q = query(collection(db, "invoices"), where("userId", "==", currentUserId));
    invoicesUnsubscribe = onSnapshot(q, (snapshot) => {
        let totalCount = 0;
        let totalRev = 0;
        let allInvoices = [];
        snapshot.forEach(doc => {
            totalCount++;
            const data = doc.data();
            totalRev += data.grandTotal || 0;
            allInvoices.push({ id: doc.id, ...data });
        });
        
        allInvoices.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const recentList = allInvoices.slice(0, 5);
        
        const statValues = document.querySelectorAll('#view-dashboard .stat-value');
        if (statValues.length >= 2) {
            statValues[0].textContent = totalCount;
            statValues[1].textContent = '₹' + totalRev.toFixed(2);
        }
        
        const mockupBody = document.querySelector('#view-dashboard .mockup-body');
        if (mockupBody) {
            if (recentList.length === 0) {
                mockupBody.innerHTML = `
                    <p>No recent invoices found.</p>
                    <p style="font-size: 0.8rem; margin-top: 0.5rem;">Create your first bill to see activity here.</p>
                `;
            } else {
                let html = '<div style="text-align: left; padding: 0.5rem 1rem; max-height: 250px; overflow-y: auto;">';
                recentList.forEach(inv => {
                    html += `
                        <div class="recent-activity-row">
                            <div class="recent-activity-content">
                                <div class="recent-activity-icon">
                                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <div class="recent-activity-details">
                                    <strong style="color: var(--text-main); font-size: 0.95rem;">${inv.receiverName || 'Unknown Customer'}</strong>
                                    <span style="font-size: 0.8rem; color: var(--text-muted);">Invoice #${inv.invoiceNo || 'N/A'} • ${inv.date || 'N/A'}</span>
                                </div>
                            </div>
                            <div style="font-weight: 600; color: #10b981; font-size: 1.1rem;">₹${(inv.grandTotal || 0).toFixed(2)}</div>
                        </div>
                    `;
                });
                html += '</div>';
                mockupBody.innerHTML = html;
            }
        }
    });
}

// Setup Sign Out Button
document.addEventListener('DOMContentLoaded', () => {
    const signOutBtn = document.getElementById('sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'auth.html';
            });
        });
    }
});

// State management
        const state = {
            meta: {},
            items: [{ id: Date.now(), desc: '', hsn: '', qty: 0, uom: 'PCS', rate: 0 }],
            adjustments: { discount: 0, cartage: 0, sgst: 9, cgst: 9, igst: 0 }
        };

        // DOM Elements
        const editorPanel = document.querySelector('.editor-panel');
        const itemsList = document.getElementById('editor-items-list');
        const previewItemsBody = document.getElementById('preview-items-body');

        // Initialization
        function init() {
            document.getElementById('date-input').valueAsDate = new Date();
            renderEditor();
            attachEventListeners();
            syncAll();
        }

        function attachEventListeners() {
            // Event delegation for all inputs in the editor panel
            editorPanel.addEventListener('input', (e) => {
                const el = e.target;

                // Handle Meta Fields (data-sync)
                if (el.dataset.sync) {
                    const field = el.dataset.sync;
                    state.meta[field] = el.value;
                    const previewEl = document.getElementById('view-' + field);
                    if (previewEl) {
                        if (field === 'terms') {
                            // Split by newline, filter empty lines, escape HTML to be safe, then wrap in <li>
                            previewEl.innerHTML = el.value.split('\n')
                                .filter(l => l.trim())
                                .map(line => {
                                    const li = document.createElement('li');
                                    li.textContent = line;
                                    return li.outerHTML;
                                })
                                .join('');
                        } else {
                            previewEl.textContent = el.value;
                        }
                    }

                    // Special case for footer name which mirrors seller name
                    if (field === 'seller-name') {
                        const footerName = document.getElementById('view-seller-name-footer');
                        if (footerName) footerName.textContent = el.value;
                    }
                }

                // Handle Adjustments
                if (el.id.endsWith('-val')) {
                    const key = el.id.replace('-val', '').replace('-rate', '');
                    state.adjustments[key] = parseFloat(el.value) || 0;
                }

                calculateAndSync();
            });
        }

        function addItemRow() {
            state.items.push({ id: Date.now(), desc: '', hsn: '', qty: 0, uom: 'PCS', rate: 0 });
            renderEditor();
            calculateAndSync();
        }

        function removeItem(id) {
            if (state.items.length <= 1) return;
            state.items = state.items.filter(item => item.id !== id);
            renderEditor();
            calculateAndSync();
        }

        function updateItem(id, field, value) {
            const item = state.items.find(i => i.id === id);
            if (item) {
                item[field] = value;
                if (field === 'qty' || field === 'rate') {
                    item.total = (item.qty || 0) * (item.rate || 0);
                    const totalInput = document.getElementById(`total-${id}`);
                    if (totalInput) totalInput.value = item.total;
                }
                calculateAndSync();
            }
        }

        function renderEditor() {
            // Use a document fragment for better performance if rows were numerous
            itemsList.innerHTML = '';
            state.items.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'item-row';
                row.innerHTML = `
                <div class="input-group" style="position: relative; overflow: visible;">
                    <input type="text" placeholder="Description" value="${item.desc}" 
                           onfocus="window.showInventorySuggestions(${item.id})" 
                           oninput="updateItem(${item.id}, 'desc', this.value); window.filterInventorySuggestions(${item.id}, this.value)"
                           onblur="setTimeout(() => window.hideInventorySuggestions(${item.id}), 200)"
                           autocomplete="off">
                    <div id="suggestions-${item.id}" class="suggestions-box" style="display:none; position:absolute; top:100%; left:0; right:0; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; z-index:9999; max-height:150px; overflow-y:auto; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"></div>
                </div>
                <div class="input-group">
                    <input type="text" placeholder="HSN" value="${item.hsn}" oninput="updateItem(${item.id}, 'hsn', this.value)">
                </div>
                <div class="input-group">
                    <input type="number" placeholder="Qty" value="${item.qty}" oninput="updateItem(${item.id}, 'qty', parseFloat(this.value)||0)">
                </div>
                <div class="input-group">
                    <input type="text" placeholder="UOM" value="${item.uom}" oninput="updateItem(${item.id}, 'uom', this.value)">
                </div>
                <div class="input-group">
                    <input type="number" placeholder="Rate" value="${item.rate}" oninput="updateItem(${item.id}, 'rate', parseFloat(this.value)||0)">
                </div>
                <div class="input-group">
                    <input type="number" id="total-${item.id}" placeholder="Total" value="${item.total !== undefined ? item.total : ((item.qty || 0) * (item.rate || 0))}" oninput="updateItem(${item.id}, 'total', parseFloat(this.value)||0)">
                </div>
                <button class="btn-remove" title="Remove Item" onclick="removeItem(${item.id})">×</button>
            `;
                itemsList.appendChild(row);
            });
        }

        function calculateAndSync() {
            let subTotal = 0;

            // Sync Preview Items Body
            previewItemsBody.innerHTML = '';
            state.items.forEach((item, i) => {
                const rowTotal = item.total !== undefined ? parseFloat(item.total) : ((item.qty || 0) * (item.rate || 0));
                subTotal += rowTotal;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td>${i + 1}</td>
                <td class="text-left">${item.desc || '<span style="color:#ccc">...</span>'}</td>
                <td>${item.hsn}</td>
                <td>${item.qty}</td>
                <td>${item.uom}</td>
                <td>${item.rate.toFixed(2)}</td>
                <td>${rowTotal.toFixed(2)}</td>
            `;
                previewItemsBody.appendChild(tr);
            });

            // Add padding rows for visual consistency
            for (let i = state.items.length; i < 6; i++) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>';
                previewItemsBody.appendChild(tr);
            }

            // Totals logic
            const adj = state.adjustments;
            const taxableAmt = subTotal - adj.discount + adj.cartage;

            const sgstAmt = taxableAmt * (adj.sgst / 100);
            const cgstAmt = taxableAmt * (adj.cgst / 100);
            const igstAmt = taxableAmt * (adj.igst / 100);
            const grandTotal = Math.round(taxableAmt + sgstAmt + cgstAmt + igstAmt);

            // Batch DOM updates
            updateElement('view-sale-value', subTotal.toFixed(2));
            updateElement('view-discount-amt', adj.discount.toFixed(2));
            updateElement('view-cartage-amt', adj.cartage.toFixed(2));
            updateElement('view-taxable-amt', taxableAmt.toFixed(2));

            updateElement('view-sgst-rate', adj.sgst);
            updateElement('view-sgst-amt', sgstAmt.toFixed(2));
            updateElement('view-cgst-rate', adj.cgst);
            updateElement('view-cgst-amt', cgstAmt.toFixed(2));
            updateElement('view-igst-rate', adj.igst);
            updateElement('view-igst-amt', igstAmt.toFixed(2));

            updateElement('view-grand-total', grandTotal.toFixed(2));
            updateElement('view-amount-words', numberToWords(grandTotal) + " Only");
        }

        function updateElement(id, value) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }

        function syncAll() {
            // Trigger sync for all fields with data-sync
            document.querySelectorAll('[data-sync]').forEach(el => {
                const event = new Event('input', { bubbles: true });
                el.dispatchEvent(event);
            });
            calculateAndSync();
        }

        function numberToWords(num) {
            if (num === 0) return "Zero";
            const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
            const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

            if ((num = num.toString()).length > 9) return 'Overflow';
            let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!n) return '';
            let str = '';
            str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
            str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
            str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
            str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
            str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
            return str.trim();
        }

        function resetForm() {
            if (confirm('This will clear all entries. Continue?')) {
                window.location.reload();
            }
        }

        window.showInventorySuggestions = function(id) {
            window.filterInventorySuggestions(id, '');
        };
        
        window.filterInventorySuggestions = function(id, query) {
            const box = document.getElementById('suggestions-' + id);
            if (!box) return;
            if (!window.globalInventory || window.globalInventory.length === 0) {
                box.style.display = 'none';
                return;
            }
            const q = query.toLowerCase();
            const matches = window.globalInventory.filter(inv => inv.name.toLowerCase().includes(q));
            if (matches.length === 0) {
                box.style.display = 'none';
                return;
            }
            box.innerHTML = '';
            matches.forEach(match => {
                const div = document.createElement('div');
                div.style.padding = '8px 12px';
                div.style.cursor = 'pointer';
                div.style.borderBottom = '1px solid var(--border)';
                const godownText = match.godown ? ` <span style="font-size:0.7rem; background:#eee; padding:2px 4px; border-radius:4px; margin-left:4px;">${match.godown}</span>` : '';
                div.innerHTML = `<strong>${match.name}</strong>${godownText} <span style="float:right; font-size:0.8rem; color:var(--text-muted)">Stock: ${match.stock}</span>`;
                div.onmousedown = (e) => { // mousedown fires before blur
                    e.preventDefault(); 
                    window.selectInventoryItem(id, match);
                };
                div.onmouseover = () => div.style.background = 'var(--table-hover)';
                div.onmouseout = () => div.style.background = 'transparent';
                box.appendChild(div);
            });
            box.style.display = 'block';
        };
        
        window.hideInventorySuggestions = function(id) {
            const box = document.getElementById('suggestions-' + id);
            if (box) box.style.display = 'none';
        };
        
        window.selectInventoryItem = function(itemId, invItem) {
            updateItem(itemId, 'desc', invItem.name);
            updateItem(itemId, 'hsn', invItem.hsn || '');
            updateItem(itemId, 'rate', invItem.price || 0);
            updateItem(itemId, 'uom', invItem.unit || 'PCS');
            updateItem(itemId, 'invId', invItem.id);
            if (state.items.find(i => i.id === itemId).qty === 0) {
                updateItem(itemId, 'qty', 1);
            }
            renderEditor();
            calculateAndSync();
        };

        window.saveAndPrintInvoice = async function() {
            if (!currentUserId) return alert("Please log in to save invoices.");
            
            let promises = [];
            for (const item of state.items) {
                if (item.invId && item.qty > 0) {
                    const invDoc = window.globalInventory.find(inv => inv.id === item.invId);
                    if (invDoc) {
                        const newStock = Math.max(0, invDoc.stock - item.qty);
                        promises.push(updateDoc(doc(db, "inventory", item.invId), {
                            stock: newStock,
                            updatedAt: new Date()
                        }));
                    }
                }
            }
            
            const invoiceData = {
                userId: currentUserId,
                invoiceNo: state.meta['invoice-no'] || '',
                date: document.getElementById('date-input').value || new Date().toISOString().split('T')[0],
                receiverName: state.meta['receiver-name'] || 'Unknown Customer',
                grandTotal: parseFloat(document.getElementById('view-grand-total').textContent) || 0,
                createdAt: new Date().getTime(), // using timestamp for easier sorting
                items: state.items
            };
            
            promises.push(addDoc(collection(db, "invoices"), invoiceData));
            
            if (promises.length > 0) {
                try {
                    await Promise.all(promises);
                } catch(e) {
                    console.error("Error saving invoice or updating stock: ", e);
                    alert("Error saving invoice and updating inventory stock.");
                    return;
                }
            }
            
            window.print();
        };

        // Expose functions to window for inline HTML handlers
        window.addItemRow = addItemRow;
        window.removeItem = removeItem;
        window.updateItem = updateItem;
        window.resetForm = resetForm;

        // Launch!
        init();

// Feedback Widget Logic
document.addEventListener('DOMContentLoaded', () => {
    const feedbackTrigger = document.getElementById('feedback-trigger');
    const feedbackPanel = document.getElementById('feedback-panel');
    const feedbackClose = document.getElementById('feedback-close');
    const feedbackForm = document.getElementById('feedback-form');
    const feedbackSuccess = document.getElementById('feedback-success');

    if (feedbackTrigger && feedbackPanel && feedbackClose) {
        feedbackTrigger.addEventListener('click', () => {
            feedbackPanel.classList.toggle('show');
        });

        feedbackClose.addEventListener('click', () => {
            feedbackPanel.classList.remove('show');
        });

        feedbackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Mock backend submission
            feedbackForm.style.display = 'none';
            feedbackSuccess.style.display = 'block';
            
            setTimeout(() => {
                feedbackPanel.classList.remove('show');
                // Reset form for next time
                setTimeout(() => {
                    feedbackForm.reset();
                    feedbackForm.style.display = 'flex';
                    feedbackSuccess.style.display = 'none';
                }, 500);
            }, 2000);
        });
    }
});
