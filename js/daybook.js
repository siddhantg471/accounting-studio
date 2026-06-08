import { db, auth } from '../../backend/firebase-config.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let currentUserId = null;
let daybookUnsubscribe = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadDaybook();
        populateLedgers();
    } else {
        currentUserId = null;
        if (daybookUnsubscribe) daybookUnsubscribe();
    }
});

function loadDaybook() {
    const q = query(collection(db, "daybook"), where("userId", "==", currentUserId));
    
    daybookUnsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('daybook-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Sort entries by date descending
        const entries = [];
        snapshot.forEach(doc => entries.push({id: doc.id, ...doc.data()}));
        entries.sort((a, b) => new Date(b.date) - new Date(a.date));

        entries.forEach((data) => {
            const tr = document.createElement('tr');
            const amtClass = (data.type === 'Receipt') ? 'positive' : (data.type === 'Payment' ? 'negative' : '');
            const typeBadge = `<span class="badge" style="padding:4px 8px;">${data.type}</span>`;
            
            tr.innerHTML = `
                <td>${data.date}</td>
                <td>${typeBadge}</td>
                <td style="font-weight:500;">${data.ledger}</td>
                <td>${data.description || '-'}</td>
                <td class="amount ${amtClass}">₹${parseFloat(data.amount).toFixed(2)}</td>
                <td>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem;" onclick="window.editDaybook('${data.id}', '${data.date}', '${data.type}', '${data.ledger}', '${data.amount}', '${data.description}')">Edit</button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:#ef4444; border-color:#ef4444;" onclick="window.deleteDaybook('${data.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

function populateLedgers() {
    const select = document.getElementById('entry-ledger');
    if(!select) return;
    
    const q = query(collection(db, "ledgers"), where("userId", "==", currentUserId));
    onSnapshot(q, (snapshot) => {
        // Keep the default options
        select.innerHTML = `
            <option value="">Select Ledger</option>
            <option value="Cash">Cash Account</option>
            <option value="Bank">Bank Account</option>
        `;
        snapshot.forEach((doc) => {
            const data = doc.data();
            select.innerHTML += `<option value="${data.name}">${data.name}</option>`;
        });
    });
}

window.showDaybookModal = () => {
    document.getElementById('entry-id').value = '';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entry-date').value = today;
    document.getElementById('entry-type').value = 'Payment';
    document.getElementById('entry-ledger').value = '';
    document.getElementById('entry-amount').value = '0';
    document.getElementById('entry-desc').value = '';
    document.getElementById('daybook-modal-title').textContent = 'Add Journal Entry';
    document.getElementById('daybook-modal').style.display = 'flex';
};

window.closeDaybookModal = () => {
    document.getElementById('daybook-modal').style.display = 'none';
};

window.editDaybook = (id, date, type, ledger, amount, desc) => {
    document.getElementById('entry-id').value = id;
    document.getElementById('entry-date').value = date;
    document.getElementById('entry-type').value = type;
    document.getElementById('entry-ledger').value = ledger;
    document.getElementById('entry-amount').value = amount;
    document.getElementById('entry-desc').value = desc === 'undefined' ? '' : desc;
    document.getElementById('daybook-modal-title').textContent = 'Edit Journal Entry';
    document.getElementById('daybook-modal').style.display = 'flex';
};

window.deleteDaybook = async (id) => {
    if(confirm('Are you sure you want to delete this entry?')) {
        try {
            await deleteDoc(doc(db, "daybook", id));
        } catch (e) {
            console.error("Error deleting document: ", e);
            alert("Error deleting entry.");
        }
    }
};

document.getElementById('daybook-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) return alert("You must be logged in to save entries.");
    
    const id = document.getElementById('entry-id').value;
    const date = document.getElementById('entry-date').value;
    const type = document.getElementById('entry-type').value;
    const ledger = document.getElementById('entry-ledger').value;
    const amount = parseFloat(document.getElementById('entry-amount').value) || 0;
    const description = document.getElementById('entry-desc').value;

    const entryData = {
        date, type, ledger, amount, description,
        userId: currentUserId,
        updatedAt: new Date()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "daybook", id), entryData);
        } else {
            entryData.createdAt = new Date();
            await addDoc(collection(db, "daybook"), entryData);
        }
        window.closeDaybookModal();
    } catch (e) {
        console.error("Error saving document: ", e);
        alert("Error saving entry.");
    }
});
