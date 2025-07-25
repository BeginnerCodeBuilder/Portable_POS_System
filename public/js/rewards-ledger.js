(async () => {
  console.log("✅ JS injected: rewards-ledger.js");

  const ledgerTableBody = document.getElementById("rewards-ledger-body");
  const pagination = document.getElementById("rewards-ledger-pagination");

  const customerSelect = document.getElementById("filter-customer");
  const dateFromInput = document.getElementById("filter-date-from");
  const dateToInput = document.getElementById("filter-date-to");
  const typeFilter = document.getElementById("filter-type");

  const btnExport = document.getElementById("btn-export-ledger");
  const btnReset = document.getElementById("btn-reset-filters");

  const notesModal = document.getElementById("ledger-notes-modal");
  const notesField = document.getElementById("ledger-note");
  const btnSaveNote = document.getElementById("btn-save-ledger-note");
  const btnCancelNote = document.getElementById("btn-cancel-ledger-note");

  let currentLedger = [];
  let currentPage = 1;
  const rowsPerPage = 25;
  let currentNoteId = null;

  // Fetch all ledger entries
  async function loadLedger() {
    const filters = {
      customer: customerSelect.value || null,
      dateFrom: dateFromInput.value || null,
      dateTo: dateToInput.value || null,
      type: typeFilter.value || "All",
    };

    try {
      const data = await window.api.getRewardsLedger(filters);
      currentLedger = data;
      renderTable();
    } catch (err) {
      console.error("❌ Failed to load rewards ledger:", err);
    }
  }

  function renderTable() {
    ledgerTableBody.innerHTML = "";

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = currentLedger.slice(start, end);

    for (const row of pageData) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.id}</td>
        <td>${row.date}</td>
        <td>${row.customer_id}</td>
        <td>${row.customer_name}</td>
        <td>${row.type}</td>
        <td>${row.points}</td>
        <td>${row.equivalent_value || "-"}</td>
        <td>${row.conversion_rate}</td>
        <td>${row.order_number || "-"}</td>
        <td>${row.notes || ""}</td>
        <td><button class="short-button" data-id="${row.id}" data-notes="${row.notes || ""}">✏️</button></td>
      `;
      ledgerTableBody.appendChild(tr);
    }

    renderPagination();
  }

  function renderPagination() {
    const totalPages = Math.ceil(currentLedger.length / rowsPerPage);
    pagination.innerHTML = `
      <button ${currentPage === 1 ? "disabled" : ""} id="btn-prev-page">◀</button>
      <span>${currentPage} / ${totalPages || 1}</span>
      <button ${currentPage === totalPages ? "disabled" : ""} id="btn-next-page">▶</button>
    `;

    document.getElementById("btn-prev-page")?.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage--;
        renderTable();
      }
    });

    document.getElementById("btn-next-page")?.addEventListener("click", () => {
      const totalPages = Math.ceil(currentLedger.length / rowsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderTable();
      }
    });
  }

  ledgerTableBody.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      currentNoteId = e.target.dataset.id;
      notesField.value = e.target.dataset.notes || "";
      notesModal.classList.remove("hidden");
    }
  });

  btnSaveNote.addEventListener("click", async () => {
    try {
      await window.api.updateRewardsLedgerNote({
        id: currentNoteId,
        notes: notesField.value.trim(),
      });
      notesModal.classList.add("hidden");
      await loadLedger();
    } catch (err) {
      console.error("❌ Failed to update note:", err);
    }
  });

  btnCancelNote.addEventListener("click", () => {
    notesModal.classList.add("hidden");
    currentNoteId = null;
  });

  btnExport.addEventListener("click", async () => {
    const filters = {
      customer: customerSelect.value || null,
      dateFrom: dateFromInput.value || null,
      dateTo: dateToInput.value || null,
      type: typeFilter.value || "All",
    };

    try {
      await window.api.exportRewardsLedger(filters);
    } catch (err) {
      console.error("❌ Export failed:", err);
    }
  });

  btnReset.addEventListener("click", () => {
    customerSelect.value = "";
    dateFromInput.value = "";
    dateToInput.value = "";
    typeFilter.value = "All";
    currentPage = 1;
    loadLedger();
  });

  // Initial load
  await loadLedger();
})();
