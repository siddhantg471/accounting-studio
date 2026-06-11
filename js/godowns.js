import { db, auth } from '../../backend/firebase-config.js';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let currentUserId = null;
let godownsUnsubscribe = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadGodowns();
    } else {
        currentUserId = null;
        if (godownsUnsubscribe) godownsUnsubscribe();
    }
});

function loadGodowns() {
    const q = query(collection(db, "godowns"), where("userId", "==", currentUserId));
    
    godownsUnsubscribe = onSnapshot(q, (snapshot) => {
        const tbody = document.getElementById('godowns-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.name}</td>
                <td>${data.location || '-'}</td>
                <td>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem;" onclick="window.editGodown('${doc.id}', '${data.name}', '${data.location || ''}')">Edit</button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:#ef4444; border-color:#ef4444;" onclick="window.deleteGodown('${doc.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        populateGodownDropdowns(snapshot);
    });
}

function populateGodownDropdowns(snapshot) {
    const selects = document.querySelectorAll('.godown-dropdown');
    selects.forEach(select => {
        const currentVal = select.value;
        select.innerHTML = '<option value="Main Location">Main Location</option>';
        snapshot.forEach((doc) => {
            const data = doc.data();
            select.innerHTML += `<option value="${data.name}">${data.name}</option>`;
        });
        if (currentVal) select.value = currentVal;
    });
}

window.showGodownModal = () => {
    document.getElementById('godown-id').value = '';
    document.getElementById('godown-name').value = '';
    document.getElementById('godown-location').value = '';
    document.getElementById('godown-modal-title').textContent = 'Add Godown';
    document.getElementById('godown-modal').style.display = 'flex';
};

window.closeGodownModal = () => {
    document.getElementById('godown-modal').style.display = 'none';
};

window.editGodown = (id, name, location) => {
    document.getElementById('godown-id').value = id;
    document.getElementById('godown-name').value = name;
    document.getElementById('godown-location').value = location;
    document.getElementById('godown-modal-title').textContent = 'Edit Godown';
    document.getElementById('godown-modal').style.display = 'flex';
};

window.deleteGodown = async (id) => {
    if(confirm('Are you sure you want to delete this Godown?')) {
        try {
            await deleteDoc(doc(db, "godowns", id));
        } catch (e) {
            console.error("Error deleting document: ", e);
            alert("Error deleting Godown.");
        }
    }
};

document.getElementById('godown-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) return alert("You must be logged in to save.");
    
    const id = document.getElementById('godown-id').value;
    const name = document.getElementById('godown-name').value;
    const location = document.getElementById('godown-location').value;

    const godownData = {
        name, location,
        userId: currentUserId,
        updatedAt: new Date()
    };

    try {
        if (id) {
            await updateDoc(doc(db, "godowns", id), godownData);
        } else {
            godownData.createdAt = new Date();
            await addDoc(collection(db, "godowns"), godownData);
        }
        window.closeGodownModal();
    } catch (e) {
        console.error("Error saving document: ", e);
        alert("Error saving Godown.");
    }
});
