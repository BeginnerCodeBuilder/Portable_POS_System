(() => {
  const state = {
    selectedGroup: null,
    selectedStatus: "All",
    search: "",
    currentPage: 1,
    entriesPerPage: 10,
  };

  const el = {
    groupList: document.getElementById("group-list"),
    groupFilter: document.getElementById("filter-group"),
    statusFilter: document.getElementById("filter-status"), // NEW
    searchInput: document.getElementById("search-item"),
    searchInput: document.getElementById("search-item"),
    entriesSelect: document.getElementById("entries-per-page"),
    pagination: document.getElementById("pagination"),
    itemTableBody: document.querySelector("#item-table"),
    itemModal: document.getElementById("item-modal"),
    itemForm: document.getElementById("item-form"),
    itemFields: {
      groupId: document.getElementById("item-group-id"),
      itemId: document.getElementById("item-id"),
      name: document.getElementById("item-name"),
      desc: document.getElementById("item-desc"),
      price: document.getElementById("item-price"),
      stock: document.getElementById("item-stock"),
      reorder: document.getElementById("item-reorder"),
      barcode: document.getElementById("item-barcode"),
      status: document.getElementById("item-status"), // NEW
    },
    itemSaveBtn: document.getElementById("btn-save-item"),
    itemCancelBtn: document.getElementById("btn-cancel-item"),
    importBtn: document.getElementById("btn-import-items"),
    exportBtn: document.getElementById("btn-export-items"),
    groupModal: document.getElementById("group-modal"),
    groupForm: document.getElementById("group-form"),
    groupIdInput: document.getElementById("group-id"),
    groupNameInput: document.getElementById("group-name"),
    groupSaveBtn: document.getElementById("btn-save-group"),
    groupCancelBtn: document.getElementById("btn-cancel-group"),
  };

  const loadGroups = async () => {
    try {
      const groups = await window.api.inventory.getGroups();
      el.groupList.innerHTML = `<div class="group-option ${state.selectedGroup === null ? "active" : ""}" data-id="">All Items</div>`;
      el.groupFilter.innerHTML = `<option value="All">All</option>`;
      el.itemFields.groupId.innerHTML = `<option value="">-- Select Group --</option>`;

      groups.forEach((g) => {
        el.groupList.innerHTML += `<div class="group-option ${state.selectedGroup === g.id ? "active" : ""}" data-id="${g.id}">${g.name} (${g.id})</div>`;
        el.groupFilter.innerHTML += `<option value="${g.id}">${g.name} (${g.id})</option>`;
        el.itemFields.groupId.innerHTML += `<option value="${g.id}">${g.name} (${g.id})</option>`;
      });

      attachGroupListeners();
    } catch (err) {
      console.error("❌ Failed to load groups:", err);
    }
  };

  const attachGroupListeners = () => {
    document.querySelectorAll(".group-option").forEach((elGroup) => {
      elGroup.onclick = () => {
        const id = elGroup.getAttribute("data-id");
        state.selectedGroup = id || null;
        state.currentPage = 1;
        loadItems();
        loadGroups(); // refresh active
      };
    });
  };

  const loadItems = async () => {
    try {
      const items = await window.api.inventory.getItems({
        search: state.search,
        group: state.selectedGroup,
        status: state.selectedStatus,
      });

      const start = (state.currentPage - 1) * state.entriesPerPage;
      const pagedItems = items.slice(start, start + state.entriesPerPage);

      el.itemTableBody.innerHTML = "";
      pagedItems.forEach((item) => {
        el.itemTableBody.innerHTML += `
          <tr>
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${item.description || "-"}</td>
            <td>₱${item.unit_price.toFixed(2)}</td>
            <td>${item.stock}</td>
            <td>${item.reorder_level}</td>
            <td>${item.group_name} (${item.group_id})</td>
            <td>${item.barcode || "-"}</td>
            <td>${item.status}</td>
            <td><button class="short-button edit-item" data-id="${item.id}">Edit</button></td>
          </tr>`;
      });

      renderPagination(items.length);
      attachEditListeners(items);
    } catch (err) {
      console.error("❌ Failed to load items:", err);
    }
  };

  const renderPagination = (total) => {
    const pages = Math.ceil(total / state.entriesPerPage);
    el.pagination.innerHTML = `
      <button ${state.currentPage === 1 ? "disabled" : ""} id="prev-page">Prev</button>
      Page <input type="number" id="jump-page" min="1" max="${pages}" value="${state.currentPage}" />
      of ${pages}
      <button ${state.currentPage === pages ? "disabled" : ""} id="next-page">Next</button>
    `;

    document.getElementById("prev-page").onclick = () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        loadItems();
      }
    };
    document.getElementById("next-page").onclick = () => {
      if (state.currentPage < pages) {
        state.currentPage++;
        loadItems();
      }
    };
    document.getElementById("jump-page").onchange = (e) => {
      const val = parseInt(e.target.value);
      if (val >= 1 && val <= pages) {
        state.currentPage = val;
        loadItems();
      }
    };
  };

  const attachEditListeners = (items) => {
    document.querySelectorAll(".edit-item").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        const item = items.find((i) => i.id === id);
        if (!item) return alert("Item not found.");

        // Disable changing group
        el.itemFields.groupId.value = item.group_id;
        el.itemFields.groupId.disabled = true;

        el.itemFields.itemId.value = item.id;
        el.itemFields.name.value = item.name;
        el.itemFields.desc.value = item.description || "";
        el.itemFields.price.value = item.unit_price;
        el.itemFields.stock.value = item.stock;
        el.itemFields.reorder.value = item.reorder_level;
        el.itemFields.barcode.value = item.barcode || "";
        el.itemFields.status.value = item.status || "Active";

        el.itemModal.classList.remove("hidden");
      };
    });
  };

  const saveItem = async () => {
    const isNew = !el.itemFields.itemId.value;
    const item = {
      id: el.itemFields.itemId.value || null,
      group_id: el.itemFields.groupId.value,
      name: el.itemFields.name.value.trim(),
      description: el.itemFields.desc.value,
      unit_price: parseFloat(el.itemFields.price.value),
      stock: parseInt(el.itemFields.stock.value),
      reorder_level: parseInt(el.itemFields.reorder.value),
      barcode: el.itemFields.barcode.value.trim() || null,
      status: isNew ? "Active" : el.itemFields.status.value,
    };

    if (!item.group_id || !item.name || isNaN(item.unit_price) || isNaN(item.stock) || isNaN(item.reorder_level)) {
      return alert("Please fill in all required fields.");
    }

    try {
      if (item.id) {
        await window.api.inventory.updateItem(item);
      } else {
        await window.api.inventory.addItem(item);
      }
      alert("✅ Item saved.");
      el.itemModal.classList.add("hidden");
      el.itemFields.groupId.disabled = false;
      loadItems();
    } catch (err) {
      console.error("❌ Failed to save item:", err);
      alert("Error saving item.");
    }
  };

  const saveGroup = async () => {
    const id = el.groupIdInput.value.trim();
    const name = el.groupNameInput.value.trim();
    if (!/^\d{2}$/.test(id) || !name) return alert("Invalid Group ID or name");

    try {
      await window.api.inventory.addGroup({ id, name });
      el.groupModal.classList.add("hidden");
      el.groupForm.reset();
      loadGroups();
    } catch (err) {
      alert("❌ Failed to save group");
      console.error(err);
    }
  };

  const doExport = async () => {
    try {
      const csv = await window.api.inventory.exportItems();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0];
      a.download = `inventory_export_${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("❌ Failed to export items");
      console.error(err);
    }
  };

  const doImport = () => {
    const modal = document.createElement("div");
    modal.classList.add("modal");
    modal.innerHTML = `
      <div class="modal-content">
        <h2>📥 Import Items</h2>
        <p><strong>Required Columns:</strong> Item Group ID, Item Name, Unit Price, Current Stock, Reorder Level</p>
        <p><strong>Optional:</strong> Description, Barcode</p>
        <div class="dropzone" id="import-dropzone">Drop or upload file here</div>
        <div class="modal-actions">
          <button id="btn-close-import" class="short-button">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const dropzone = modal.querySelector("#import-dropzone");
    dropzone.onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv";
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) processImport(file);
      };
      input.click();
    };

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    };
    dropzone.ondragleave = () => dropzone.classList.remove("dragover");
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) processImport(file);
    };

    modal.querySelector("#btn-close-import").onclick = () => modal.remove();
  };

  const processImport = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const rows = text.trim().split("\n").map(line => {
          const [groupId, name, desc, price, stock, reorder, barcode] = line.split(",");
          return {
            "Item Group ID": groupId,
            "Item Name": name,
            "Description": desc,
            "Unit Price": price,
            "Current Stock": stock,
            "Reorder Level": reorder,
            "Barcode": barcode,
          };
        });

        const result = await window.api.inventory.importItems(rows);
        alert(`✅ Import Complete:\n${result.added} added\n${result.skipped} skipped\n${result.failed} failed`);
        loadItems();
      } catch (err) {
        alert("❌ Import failed");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  // 🔹 Bindings
  el.searchInput.oninput = (e) => {
    state.search = e.target.value;
    state.currentPage = 1;
    loadItems();
  };

  el.groupFilter.onchange = (e) => {
    const val = e.target.value;
    state.selectedGroup = val === "All" ? null : val;
    state.currentPage = 1;
    loadItems();
  };

  el.statusFilter.onchange = (e) => {
    state.selectedStatus = e.target.value;
    state.currentPage = 1;
    loadItems();
  };

  el.entriesSelect.onchange = () => {
    state.entriesPerPage = parseInt(el.entriesSelect.value);
    state.currentPage = 1;
    loadItems();
  };

  document.getElementById("btn-add-group").onclick = () => {
    el.groupForm.reset();
    el.groupModal.classList.remove("hidden");
  };

  el.groupCancelBtn.onclick = () => el.groupModal.classList.add("hidden");
  el.groupSaveBtn.onclick = saveGroup;

  document.getElementById("btn-add-item")?.addEventListener("click", () => {
    el.itemForm.reset();
    el.itemFields.itemId.value = "";
    el.itemFields.groupId.disabled = false;
    el.itemFields.status.value = "Active";
    el.itemModal.classList.remove("hidden");
  });

  el.itemCancelBtn.onclick = () => {
    el.itemFields.groupId.disabled = false;
    el.itemModal.classList.add("hidden");
  };

  el.itemSaveBtn.onclick = saveItem;

  el.exportBtn.onclick = doExport;
  el.importBtn.onclick = doImport;

  // 🔹 Init
  loadGroups();
  loadItems();
})();
