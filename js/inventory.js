import { db, auth } from '../../backend/firebase-config.js';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

let currentUserId = null;
let inventoryUnsubscribe = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUserId = user.uid;
        loadInventory();
    } else {
        currentUserId = null;
        if (inventoryUnsubscribe) inventoryUnsubscribe();
    }
});

function loadInventory() {
    window.globalInventory = [];
    const q = query(collection(db, "inventory"), where("userId", "==", currentUserId));
    
    inventoryUnsubscribe = onSnapshot(q, (snapshot) => {
        window.globalInventory = [];
        const tbody = document.getElementById('inventory-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        snapshot.forEach((doc) => {
            const data = doc.data();
            window.globalInventory.push({ id: doc.id, ...data });
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${data.name}</td>
                <td>${data.hsn || '-'}</td>
                <td style="font-weight:600;">${data.stock}</td>
                <td>${data.unit || 'PCS'}</td>
                <td style="font-weight:600; color:#10b981;">₹${parseFloat(data.price || 0).toFixed(2)}</td>
                <td><span class="badge" style="background:var(--table-hover); color:var(--text-main); border:1px solid var(--border);">${data.godown || 'Main Location'}</span></td>
                <td>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem;" onclick="window.editInventory('${doc.id}', '${data.name}', '${data.hsn}', '${data.unit}', '${data.price}', '${data.stock}', '${data.godown || 'Main Location'}')">Edit</button>
                    <button class="btn btn-outline" style="padding:4px 8px; font-size:0.7rem; color:#ef4444; border-color:#ef4444;" onclick="window.deleteInventory('${doc.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

// Expose modal functions
window.showInventoryModal = () => {
    document.getElementById('inv-id').value = '';
    document.getElementById('inv-name').value = '';
    document.getElementById('inv-hsn').value = '';
    document.getElementById('inv-unit').value = 'PCS';
    document.getElementById('inv-price').value = '0';
    document.getElementById('inv-stock').value = '0';
    const godownEl = document.getElementById('inv-godown');
    if(godownEl) godownEl.value = 'Main Location';
    document.getElementById('inventory-modal-title').textContent = 'Add Item';
    document.getElementById('inventory-modal').style.display = 'flex';
};

window.closeInventoryModal = () => {
    document.getElementById('inventory-modal').style.display = 'none';
};

window.editInventory = (id, name, hsn, unit, price, stock, godown) => {
    document.getElementById('inv-id').value = id;
    document.getElementById('inv-name').value = name;
    document.getElementById('inv-hsn').value = hsn === 'undefined' ? '' : hsn;
    document.getElementById('inv-unit').value = unit === 'undefined' ? 'PCS' : unit;
    document.getElementById('inv-price').value = price;
    document.getElementById('inv-stock').value = stock;
    const godownEl = document.getElementById('inv-godown');
    if(godownEl) godownEl.value = godown === 'undefined' ? 'Main Location' : godown;
    document.getElementById('inventory-modal-title').textContent = 'Edit Item';
    document.getElementById('inventory-modal').style.display = 'flex';
};

window.deleteInventory = async (id) => {
    if(confirm('Are you sure you want to delete this item?')) {
        try {
            await deleteDoc(doc(db, "inventory", id));
        } catch (e) {
            console.error("Error deleting document: ", e);
            alert("Error deleting item.");
        }
    }
};

document.getElementById('inventory-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUserId) return alert("You must be logged in to save items.");
    
    const id = document.getElementById('inv-id').value;
    const name = document.getElementById('inv-name').value;
    const hsn = document.getElementById('inv-hsn').value;
    const unit = document.getElementById('inv-unit').value || 'PCS';
    const price = parseFloat(document.getElementById('inv-price').value) || 0;
    const stock = parseFloat(document.getElementById('inv-stock').value) || 0;
    const godownEl = document.getElementById('inv-godown');
    const godown = godownEl ? godownEl.value : 'Main Location';

    const itemData = {
        name, hsn, unit, price, stock, godown,
        userId: currentUserId,
        updatedAt: new Date()
    };

    try {
        if (id) {
            // Update
            await updateDoc(doc(db, "inventory", id), itemData);
        } else {
            // Add
            itemData.createdAt = new Date();
            await addDoc(collection(db, "inventory"), itemData);
        }
        window.closeInventoryModal();
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Error saving item.");
    }
});
