import { db, auth } from '../../backend/firebase-config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let currentUserId = null;
let ledgersUnsubscribe = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadLedgers();
    } else {
        currentUserId = null;
        if (ledgersUnsubscribe) ledgersUnsubscribe();
    }
});

function loadLedgers() {
    const q = query(collection(db, "ledgers"), where("userId", "==", currentUserId));
    
    ledgersUnsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('ledgers-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.name}</td>
                <td><span class="badge-category">${data.group}</span></td>
                <td>${data.gstin || '-'}</td>
                <td class="${data.opBal >= 0 ? 'amount positive' : 'amount negative'}">₹${Math.abs(data.opBal).toFixed(2)} ${data.opBal >= 0 ? 'Dr' : 'Cr'}</td>
                <td>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem;" onclick="window.editLedger('${doc.id}', '${data.name}', '${data.group}', '${data.gstin || ''}', ${data.opBal})">Edit</button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:#ef4444; border-color:#ef4444;" onclick="window.deleteLedger('${doc.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// Expose modal functions
window.showLedgerModal = () => {
    document.getElementById('ledger-id').value = '';
    document.getElementById('ledger-name').value = '';
    document.getElementById('ledger-group').value = 'Sundry Debtors';
    document.getElementById('ledger-gstin').value = '';
    document.getElementById('ledger-opbal').value = '0';
    document.getElementById('ledger-modal-title').textContent = 'Add Ledger';
    document.getElementById('ledger-modal').style.display = 'flex';
};

window.closeLedgerModal = () => {
    document.getElementById('ledger-modal').style.display = 'none';
};

window.editLedger = (id, name, group, gstin, opBal) => {
    document.getElementById('ledger-id').value = id;
    document.getElementById('ledger-name').value = name;
    document.getElementById('ledger-group').value = group;
    document.getElementById('ledger-gstin').value = gstin;
    document.getElementById('ledger-opbal').value = opBal;
    document.getElementById('ledger-modal-title').textContent = 'Edit Ledger';
    document.getElementById('ledger-modal').style.display = 'flex';
};

window.deleteLedger = async (id) => {
    if(confirm('Are you sure you want to delete this ledger?')) {
        try {
            await deleteDoc(doc(db, "ledgers", id));
        } catch (e) {
            console.error("Error deleting document: ", e);
            alert("Error deleting ledger.");
        }
    }
};

document.getElementById('ledger-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) return alert("You must be logged in to save ledgers.");
    
    const id = document.getElementById('ledger-id').value;
    const name = document.getElementById('ledger-name').value;
    const group = document.getElementById('ledger-group').value;
    const gstin = document.getElementById('ledger-gstin').value;
    const opBal = parseFloat(document.getElementById('ledger-opbal').value) || 0;

    const ledgerData = {
        name, group, gstin, opBal,
        userId: currentUserId,
        updatedAt: new Date()
    };

    try {
        if (id) {
            // Update
            await updateDoc(doc(db, "ledgers", id), ledgerData);
        } else {
            // Add
            ledgerData.createdAt = new Date();
            await addDoc(collection(db, "ledgers"), ledgerData);
        }
        window.closeLedgerModal();
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Error saving ledger.");
    }
});
