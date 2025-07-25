(() => {
  const state = {
    search: "",
    currentPage: 1,
    entriesPerPage: 10,
    allSuppliers: [],
  };

  const el = {
    tableBody: document.getElementById("supplier-table"),
    pagination: document.getElementById("supplier-pagination"),
    searchInput: document.getElementById("search-supplier"),
    addBtn: document.getElementById("btn-add-supplier"),
    exportBtn: document.getElementById("btn-export-suppliers"),
    importBtn: document.getElementById("btn-import-suppliers"),

    modal: document.getElementById("supplier-modal"),
    form: document.getElementById("supplier-form"),
    fields: {
      id: document.getElementById("supplier-id"),
      name: document.getElementById("supplier-name"),
      contact: document.getElementById("supplier-contact"),
      email: document.getElementById("supplier-email"),
      phone: document.getElementById("supplier-phone"),
      address: document.getElementById("supplier-address"),
      notes: document.getElementById("supplier-notes"),
    },
    saveBtn: document.getElementById("btn-save-supplier"),
    cancelBtn: document.getElementById("btn-cancel-supplier"),

    importModal: document.getElementById("import-suppliers-modal"),
    importFile: document.getElementById("supplier-import-file"),
    importDropzone: document.getElementById("supplier-import-dropzone"),
    confirmImport: document.getElementById("btn-confirm-supplier-import"),
    cancelImport: document.getElementById("btn-cancel-supplier-import"),
  };

  const loadSuppliers = async () => {
    try {
      const all = await window.api.suppliers.getAll();
      state.allSuppliers = all;
      renderTable();
    } catch (err) {
      console.error("❌ Failed to load suppliers:", err);
    }
  };

  const renderTable = () => {
    const filtered = state.allSuppliers.filter((s) => {
      const val = state.search.toLowerCase();
      return (
        s.name.toLowerCase().includes(val) ||
        s.id.toLowerCase().includes(val) ||
        (s.contact || "").toLowerCase().includes(val) ||
        (s.email || "").toLowerCase().includes(val)
      );
    });

    const start = (state.currentPage - 1) * state.entriesPerPage;
    const paged = filtered.slice(start, start + state.entriesPerPage);

    el.tableBody.innerHTML = "";
    paged.forEach((s) => {
      el.tableBody.innerHTML += `
        <tr>
          <td>${s.id}</td>
          <td>${s.name}</td>
          <td>${s.contact || "-"}</td>
          <td>${s.email || "-"}</td>
          <td>${s.phone}</td>
          <td>${s.address || "-"}</td>
          <td>${s.notes || "-"}</td>
          <td>
            <button class="short-button edit-supplier" data-id="${s.id}">Edit</button>
          </td>
        </tr>
      `;
    });

    renderPagination(filtered.length);
    attachEditListeners();
  };

  const renderPagination = (total) => {
    const pages = Math.ceil(total / state.entriesPerPage);
    el.pagination.innerHTML = `
      <button ${state.currentPage === 1 ? "disabled" : ""} id="prev-supplier">Prev</button>
      Page <input type="number" id="jump-supplier" min="1" max="${pages}" value="${state.currentPage}" />
      of ${pages}
      <button ${state.currentPage === pages ? "disabled" : ""} id="next-supplier">Next</button>
    `;

    document.getElementById("prev-supplier").onclick = () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTable();
      }
    };
    document.getElementById("next-supplier").onclick = () => {
      if (state.currentPage < pages) {
        state.currentPage++;
        renderTable();
      }
    };
    document.getElementById("jump-supplier").onchange = (e) => {
      const val = parseInt(e.target.value);
      if (val >= 1 && val <= pages) {
        state.currentPage = val;
        renderTable();
      }
    };
  };

  const attachEditListeners = () => {
    document.querySelectorAll(".edit-supplier").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const supplier = state.allSuppliers.find((s) => s.id === id);
        if (!supplier) return;

        el.fields.id.value = supplier.id;
        el.fields.name.value = supplier.name;
        el.fields.contact.value = supplier.contact || "";
        el.fields.email.value = supplier.email || "";
        el.fields.phone.value = supplier.phone;
        el.fields.address.value = supplier.address || "";
        el.fields.notes.value = supplier.notes || "";

        el.modal.classList.remove("hidden");
      };
    });
  };

  const saveSupplier = async () => {
    const supplier = {
      id: el.fields.id.value || null,
      name: el.fields.name.value.trim(),
      contact: el.fields.contact.value.trim(),
      email: el.fields.email.value.trim(),
      phone: el.fields.phone.value.trim(),
      address: el.fields.address.value.trim(),
      notes: el.fields.notes.value.trim(),
    };

    if (!supplier.name || !supplier.phone) {
      return alert("Supplier Name and Phone Number are required.");
    }

    if (supplier.email && !/^\S+@\S+\.\S+$/.test(supplier.email)) {
      return alert("Invalid email format.");
    }

    try {
      if (supplier.id) {
        await window.api.suppliers.update(supplier);
      } else {
        await window.api.suppliers.add(supplier);
      }

      el.modal.classList.add("hidden");
      el.form.reset();
      await loadSuppliers();
    } catch (err) {
      alert("❌ Failed to save supplier.");
      console.error(err);
    }
  };

  const handleImport = () => {
    const file = el.importFile.files[0];
    if (!file) return alert("Please select a file.");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const rows = text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [name, contact, email, phone, address, notes] = line.split(",");
            return {
              "Supplier Name": name,
              "Contact Person": contact,
              "Email": email,
              "Phone Number": phone,
              "Address": address,
              "Notes": notes,
            };
          });

        const summary = await window.api.suppliers.import(rows);
        alert(`✅ Import Summary:\nAdded: ${summary.added}\nSkipped: ${summary.skipped}\nFailed: ${summary.failed}`);
        el.importModal.classList.add("hidden");
        el.importFile.value = "";
        await loadSuppliers();
      } catch (err) {
        console.error("Import failed:", err);
        alert("❌ Import failed.");
      }
    };
    reader.readAsText(file);
  };

  const doExport = async () => {
    try {
      const csv = await window.api.suppliers.export();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0];
      a.href = url;
      a.download = `suppliers_export_${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("❌ Failed to export suppliers.");
      console.error(err);
    }
  };

  // 🔗 Bindings
  el.searchInput.oninput = (e) => {
    state.search = e.target.value;
    state.currentPage = 1;
    renderTable();
  };

  el.addBtn.onclick = () => {
    el.form.reset();
    el.fields.id.value = "";
    el.modal.classList.remove("hidden");
  };

  el.cancelBtn.onclick = () => el.modal.classList.add("hidden");
  el.saveBtn.onclick = saveSupplier;

  el.importBtn.onclick = () => el.importModal.classList.remove("hidden");
  el.cancelImport.onclick = () => el.importModal.classList.add("hidden");
  el.confirmImport.onclick = handleImport;
  el.exportBtn.onclick = doExport;

  el.importDropzone.ondragover = (e) => {
    e.preventDefault();
    el.importDropzone.classList.add("dragover");
  };
  el.importDropzone.ondragleave = () => {
    el.importDropzone.classList.remove("dragover");
  };
  el.importDropzone.ondrop = (e) => {
    e.preventDefault();
    el.importDropzone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) {
      el.importFile.files = e.dataTransfer.files;
    }
  };

  // 🚀 Init
  loadSuppliers();
})();
