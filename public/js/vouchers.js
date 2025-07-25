// File: public/js/vouchers.js
(() => {
  console.log("🧾 vouchers.js running via IIFE");

  const waitForDOM = () => {
    const typeSelect = document.getElementById("voucher-type");
    if (!typeSelect) return requestAnimationFrame(waitForDOM); // Retry until DOM ready

    const conditionalFields = document.getElementById("voucher-fields");
    const saveBtn = document.getElementById("btn-save-voucher");
    const searchInput = document.getElementById("search-voucher");
    const statusFilter = document.getElementById("voucher-status-filter");
    const entriesPerPage = document.getElementById("voucher-entries");
    const importBtn = document.getElementById("btn-import-vouchers");
    const exportBtn = document.getElementById("btn-export-vouchers");

    const importModal = document.getElementById("import-voucher-modal");
    const dropzone = document.getElementById("voucher-dropzone");
    const fileInput = document.getElementById("voucher-file-input");
    const cancelImport = document.getElementById("btn-cancel-import");

    let allVouchers = [];
    let currentPage = 1;

    // Handle Voucher Type Switching
    typeSelect.addEventListener("change", () => {
      const selected = typeSelect.value;
      conditionalFields.innerHTML = "";

      if (selected === "Single") {
        conditionalFields.innerHTML = `
          <label>Voucher ID
            <input type="text" id="voucher-id" maxlength="10" class="short-input">
            <button id="btn-generate-voucher" class="short-button">Format</button>
          </label>
          <label>Refill Equivalent
            <input type="number" id="refill" min="1" class="short-input">
          </label>
        `;
      } else if (selected === "Multi") {
        conditionalFields.innerHTML = `
          <label>Start ID
            <input type="text" id="start-id" maxlength="10" class="short-input">
          </label>
          <label>End ID
            <input type="text" id="end-id" maxlength="10" class="short-input">
            <button id="btn-generate-voucher" class="short-button">Format</button>
          </label>
          <label>Refill Equivalent
            <input type="number" id="refill" min="1" class="short-input">
          </label>
        `;
      }
    });

    // Format IDs
    document.addEventListener("click", (e) => {
      if (e.target.id === "btn-generate-voucher") {
        if (typeSelect.value === "Single") {
          const input = document.getElementById("voucher-id");
          const raw = input.value.trim();
          if (/^\d{1,10}$/.test(raw)) input.value = raw.padStart(10, "0");
          else alert("Please enter a valid number (up to 10 digits).");
        } else {
          const start = document.getElementById("start-id");
          const end = document.getElementById("end-id");
          if (/^\d{1,10}$/.test(start.value) && /^\d{1,10}$/.test(end.value)) {
            start.value = start.value.padStart(10, "0");
            end.value = end.value.padStart(10, "0");
          } else {
            alert("Start and End IDs must be numeric and up to 10 digits.");
          }
        }
      }
    });

    // Save Vouchers
    saveBtn.addEventListener("click", () => {
      const type = typeSelect.value;
      const refill = parseInt(document.getElementById("refill")?.value || 0);
      const startDate = document.getElementById("voucher-start-date").value;
      const endDate = document.getElementById("voucher-end-date").value || null;

      if (!type || !refill || !startDate) {
        alert("Please fill all required fields.");
        return;
      }

      const payload = { type, refill, start_date: startDate, end_date: endDate };

      if (type === "Single") {
        const rawId = document.getElementById("voucher-id").value.trim();
        if (!/^\d{1,10}$/.test(rawId)) {
          alert("Voucher ID must be 10 digits.");
          return;
        }
        payload.voucher_ids = [rawId.padStart(10, "0")];
      } else {
        const start = document.getElementById("start-id").value.trim();
        const end = document.getElementById("end-id").value.trim();
        if (!/^\d{1,10}$/.test(start) || !/^\d{1,10}$/.test(end)) {
          alert("Start and End IDs must be valid numbers.");
          return;
        }
        if (parseInt(start) > parseInt(end)) {
          alert("Start ID must be less than or equal to End ID.");
          return;
        }
        payload.voucher_ids = [];
        for (let i = parseInt(start); i <= parseInt(end); i++) {
          payload.voucher_ids.push(i.toString().padStart(10, "0"));
        }
      }

      window.api.saveVouchers(payload).then((result) => {
        alert(`${result.saved} added, ${result.skipped} skipped.`);
        loadVouchers();
      });
    });

    // Load Vouchers
    const loadVouchers = () => {
      window.api.getVouchers().then((res) => {
        allVouchers = res.data || [];
        currentPage = 1;
        renderTable();
      });

      window.api.getVoucherSummary().then((summary) => {
        const d = new Date();
        const dateStr = d.toLocaleDateString("en-GB");
        const text = `As of ${dateStr}, ${summary.circulation || 0} in Circulation, ${summary.used || 0} Used, ${summary.expired || 0} Expired.`;
        document.getElementById("voucher-summary").textContent = text;
      });
    };

    // Render Table
    const renderTable = () => {
      const tableBody = document.querySelector(".vouchers-table tbody");
      const search = searchInput.value.trim().toLowerCase();
      const filter = statusFilter.value;
      const entries = parseInt(entriesPerPage.value);

      const filtered = allVouchers.filter(v => {
        const match = v.id.toLowerCase().includes(search);
        const statusMatch = filter === "All" || v.status === filter;
        return match && statusMatch;
      });

      const totalPages = Math.ceil(filtered.length / entries);
      currentPage = Math.min(currentPage, totalPages || 1);
      const startIdx = (currentPage - 1) * entries;
      const pageData = filtered.slice(startIdx, startIdx + entries);

      tableBody.innerHTML = "";
      pageData.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.id}</td>
          <td>${row.date_added}</td>
          <td>${row.refill}</td>
          <td>${row.start_date}</td>
          <td>${row.end_date || "-"}</td>
          <td>${row.status}</td>
          <td><button class="edit-voucher-btn" data-id="${row.id}">Edit</button></td>
        `;
        tableBody.appendChild(tr);
      });

      document.getElementById("pagination-info").textContent = `${currentPage} / ${totalPages || 1}`;
    };

    // Pagination
    document.getElementById("prev-page").addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });
    document.getElementById("next-page").addEventListener("click", () => {
      const entries = parseInt(entriesPerPage.value);
      const totalPages = Math.ceil(allVouchers.length / entries);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });

    // Filters
    searchInput.addEventListener("input", renderTable);
    statusFilter.addEventListener("change", renderTable);
    entriesPerPage.addEventListener("change", renderTable);

    // Edit Modal
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("edit-voucher-btn")) {
        const id = e.target.dataset.id;
        const voucher = allVouchers.find(v => v.id === id);
        if (!voucher) return;

        document.getElementById("edit-voucher-id").textContent = voucher.id;
        document.getElementById("edit-date-added").textContent = voucher.date_added;
        document.getElementById("edit-refill").value = voucher.refill;
        document.getElementById("edit-start-date").value = voucher.start_date;
        document.getElementById("edit-end-date").value = voucher.end_date || "";
        document.getElementById("edit-status").value = voucher.status;
        document.getElementById("edit-voucher-modal").classList.remove("hidden");
      }
    });

    document.getElementById("btn-cancel-edit-voucher").addEventListener("click", () => {
      document.getElementById("edit-voucher-modal").classList.add("hidden");
    });

    document.getElementById("btn-confirm-edit-voucher").addEventListener("click", () => {
      const updated = {
        id: document.getElementById("edit-voucher-id").textContent,
        refill: parseInt(document.getElementById("edit-refill").value),
        start_date: document.getElementById("edit-start-date").value,
        end_date: document.getElementById("edit-end-date").value || null,
        status: document.getElementById("edit-status").value
      };

      window.api.updateVoucher(updated).then(() => {
        document.getElementById("edit-voucher-modal").classList.add("hidden");
        loadVouchers();
      });
    });

    // Import Modal Open
    importBtn.addEventListener("click", () => {
      importModal.classList.remove("hidden");
      fileInput.value = "";
    });

    // Cancel Import
    cancelImport.addEventListener("click", () => {
      importModal.classList.add("hidden");
    });

    // Drag & Drop
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file) handleImportFile(file);
    });

    // File Input
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleImportFile(file);
    });

    const handleImportFile = (file) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          const rows = text.trim().split("\n").slice(1).map(line => {
            const [id, refill, start_date, end_date, status, date_added] = line.split(",");
            return {
              id: id?.trim(),
              refill: parseInt(refill),
              start_date: start_date?.trim(),
              end_date: end_date?.trim() || null,
              status: status?.trim(),
              date_added: date_added?.trim()
            };
          });

          const result = await window.api.importVouchers(rows);
          alert(`${result.saved} added, ${result.skipped} skipped.`);
          importModal.classList.add("hidden");
          loadVouchers();
        } catch (err) {
          alert("Invalid CSV file. Please check the format.");
        }
      };
      reader.readAsText(file);
    };

    // Export
    exportBtn.addEventListener("click", async () => {
      const filters = {
        search: searchInput.value.trim(),
        status: statusFilter.value
      };
      const csv = await window.api.exportVouchers(filters);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vouchers_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Initial Load
    loadVouchers();
  };

  waitForDOM();
})();
