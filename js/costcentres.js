import { db, auth } from '../../backend/firebase-config.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let currentUserId = null;
let ccUnsubscribe = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadCostCentres();
    } else {
        currentUserId = null;
        if (ccUnsubscribe) ccUnsubscribe();
    }
});

function loadCostCentres() {
    const q = query(collection(db, "costcentres"), where("userId", "==", currentUserId));
    
    ccUnsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('costcentres-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.name}</td>
                <td>${data.description || '-'}</td>
                <td>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem;" onclick="window.editCostCentre('${doc.id}', '${data.name}', '${data.description || ''}')">Edit</button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:#ef4444; border-color:#ef4444;" onclick="window.deleteCostCentre('${doc.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Also update any dropdowns that use Cost Centres
        populateCostCentreDropdowns(snapshot);
    });
}

function populateCostCentreDropdowns(snapshot) {
    const selects = document.querySelectorAll('.cc-dropdown');
    selects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="">Not Applicable / Primary</option>';
        snapshot.forEach((doc) => {
            const data = doc.data();
            select.innerHTML += `<option value="${data.name}">${data.name}</option>`;
        });
        if (currentVal) select.value = currentVal;
    });
}

window.showCostCentreModal = () => {
    document.getElementById('cc-id').value = '';
    document.getElementById('cc-name').value = '';
    document.getElementById('cc-desc').value = '';
    document.getElementById('cc-modal-title').textContent = 'Add Cost Centre';
    document.getElementById('cc-modal').style.display = 'flex';
};

window.closeCostCentreModal = () => {
    document.getElementById('cc-modal').style.display = 'none';
};

window.editCostCentre = (id, name, desc) => {
    document.getElementById('cc-id').value = id;
    document.getElementById('cc-name').value = name;
    document.getElementById('cc-desc').value = desc;
    document.getElementById('cc-modal-title').textContent = 'Edit Cost Centre';
    document.getElementById('cc-modal').style.display = 'flex';
};

window.deleteCostCentre = async (id) => {
    if(confirm('Are you sure you want to delete this Cost Centre?')) {
        try {
            await deleteDoc(doc(db, "costcentres", id));
        } catch (e) {
            console.error("Error deleting document: ", e);
            alert("Error deleting Cost Centre.");
        }
    }
};

document.getElementById('cc-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) return alert("You must be logged in to save.");
    
    const id = document.getElementById('cc-id').value;
    const name = document.getElementById('cc-name').value;
    const description = document.getElementById('cc-desc').value;

    const ccData = {
        name, description,
        userId: currentUserId,
        updatedAt: new Date()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "costcentres", id), ccData);
        } else {
            ccData.createdAt = new Date();
            await addDoc(collection(db, "costcentres"), ccData);
        }
        window.closeCostCentreModal();
    } catch (e) {
        console.error("Error saving document: ", e);
        alert("Error saving Cost Centre.");
    }
});
