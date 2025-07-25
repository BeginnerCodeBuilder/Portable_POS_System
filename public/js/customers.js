(() => {
  const waitForRender = () => {
    const table = document.getElementById("customersTable");
    const tbody = table?.querySelector("tbody");
    const profileModal = document.getElementById("customer-profile-modal");
    const addModal = document.getElementById("customer-modal");
    if (!tbody || !profileModal || !addModal) {
      requestAnimationFrame(waitForRender);
      return;
    }

    console.log("✅ Customers module initialized");

    // ─────────────────────────────────────────────
    // 🔄 Main Table Rendering
    // ─────────────────────────────────────────────
    async function renderCustomersTable() {
      const filters = getFilters();
      const customers = await window.api.customers.getAll(filters);

      tbody.innerHTML = "";

      if (!customers.length) {
        document.getElementById("noDataMessage").classList.remove("hidden");
        return;
      }

      document.getElementById("noDataMessage").classList.add("hidden");

      for (const c of customers) {
        const row = document.createElement("tr");
        const fullName = `${c.first_name} ${c.last_name || ""}`.trim();
        const activePoints = Math.floor(Math.random() * 500);
        const equivalent = `₱${(activePoints / 100).toFixed(2)}`;
        row.innerHTML = `
          <td>${c.id}</td>
          <td>${fullName}</td>
          <td>${c.phone}</td>
          <td>${c.address}</td>
          <td>${c.type}</td>
          <td>${c.status}</td>
          <td class="points" title="${equivalent}">${activePoints}</td>
          <td><button class="view-btn" data-id="${c.id}">View</button></td>
        `;
        tbody.appendChild(row);
      }
    }

    function getFilters() {
      const filters = {};
      const typeChecked = document.getElementById("typeFilterCheckbox").checked;
      const statusChecked = document.getElementById("statusFilterCheckbox").checked;
      if (typeChecked) filters.type = document.getElementById("typeFilterSelect").value;
      if (statusChecked) filters.status = document.getElementById("statusFilterSelect").value;
      return filters;
    }

    document.getElementById("applyFiltersBtn").addEventListener("click", renderCustomersTable);

    // ─────────────────────────────────────────────
    // 🔎 Filters: Toggle dropdowns based on checkboxes
    // ─────────────────────────────────────────────
    document.getElementById("typeFilterCheckbox").addEventListener("change", (e) => {
      document.getElementById("typeFilterSelect").disabled = !e.target.checked;
    });

    document.getElementById("statusFilterCheckbox").addEventListener("change", (e) => {
      document.getElementById("statusFilterSelect").disabled = !e.target.checked;
    });

    // ─────────────────────────────────────────────
    // 🆕 Add Customer Modal
    // ─────────────────────────────────────────────
    const addBtn = document.getElementById("addCustomerBtn");
    const cancelAddBtn = document.getElementById("btn-cancel-customer");
    const saveAddBtn = document.getElementById("btn-save-customer");

    addBtn.addEventListener("click", () => {
      addModal.classList.remove("hidden");
    });

    cancelAddBtn.addEventListener("click", () => {
      addModal.classList.add("hidden");
    });

    saveAddBtn.addEventListener("click", async () => {
      const data = {
        first_name: document.getElementById("add-first-name").value.trim(),
        last_name: document.getElementById("add-last-name").value.trim(),
        phone: document.getElementById("add-phone").value.trim(),
        email: document.getElementById("add-email").value.trim(),
        address: document.getElementById("add-address").value.trim(),
        type: document.getElementById("add-type").value,
        status: document.getElementById("add-status").value,
      };

      if (!data.first_name || !data.phone || !data.address) {
        alert("Please fill in required fields: First Name, Phone, Address.");
        return;
      }

      try {
        const result = await window.api.customers.add(data);
        if (result.success) {
          alert("✅ Customer added.");
          addModal.classList.add("hidden");
          await renderCustomersTable();
        } else {
          alert("❌ Failed to add customer.");
        }
      } catch (err) {
        console.error("❌ Error saving customer:", err);
        alert("Error adding customer.");
      }
    });

    // ─────────────────────────────────────────────
    // 📥 Import / Export
    // ─────────────────────────────────────────────
    const feedbackModal = document.getElementById("import-feedback-modal");
    const importedSpan = document.getElementById("imported-count");
    const updatedSpan = document.getElementById("updated-count");
    const skippedSpan = document.getElementById("skipped-count");

    document.getElementById("importCustomersBtn").addEventListener("click", async () => {
      try {
        const { canceled, filePaths } = await window.api.customers.pickFile(); // ✅ correct
        if (canceled || !filePaths.length) return;

        const result = await window.api.customers.import(filePaths[0]);
        importedSpan.textContent = result.imported;
        updatedSpan.textContent = result.updated;
        skippedSpan.textContent = result.skipped;
        feedbackModal.classList.remove("hidden");
        await renderCustomersTable();
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    });

    document.getElementById("close-import-feedback").addEventListener("click", () => {
      feedbackModal.classList.add("hidden");
    });

    document.getElementById("exportCustomersBtn").addEventListener("click", async () => {
      try {
        await window.api.customers.export();
        alert("✅ Exported successfully.");
      } catch (err) {
        alert("❌ Export failed: " + err.message);
      }
    });

    // ─────────────────────────────────────────────
    // 🔍 View / Edit Modal
    // ─────────────────────────────────────────────
    const profileHeader = profileModal.querySelector(".modal-header h2");
    const profileContent = profileModal.querySelector(".modal-content");
    const closeProfileBtn = profileModal.querySelector(".close-button");
    const saveProfileBtn = profileModal.querySelector(".primary-button");

    async function openCustomerProfile(customerId) {
  try {
    const all = await window.api.customers.getAll({});
    const customer = all.find(c => c.id === customerId);
    if (!customer) return alert("Customer not found.");

    const logs = await window.api.customers.getLogs(customerId);

    profileHeader.textContent = `Customer Profile — ${customer.first_name} ${customer.last_name || ""}`;
    profileModal.dataset.customerId = customerId;

    profileContent.innerHTML = `
      <section class="modal-section">
        <h3>👤 Basic Info</h3>
        <div class="info-grid">
          <div><strong>Customer ID:</strong> ${customer.id}</div>
          <div><strong>Name:</strong> ${customer.first_name} ${customer.last_name || ""}</div>
          <div><strong>Mobile:</strong> ${customer.phone}</div>
          <div><strong>Email:</strong> ${customer.email || "-"}</div>
          <div><strong>Address:</strong> ${customer.address}</div>
          <div><strong>Type:</strong> ${customer.type}</div>
          <div><strong>Status:</strong> ${customer.status}</div>
          <div><strong>Date Joined:</strong> ${customer.date_joined}</div>
          <div><strong>Active Points:</strong> —</div>
        </div>
      </section>

      <section class="modal-section">
        <h3>💰 Sales Summary</h3>
        <div class="info-grid">
          <div><strong>Lifetime Sales:</strong> —</div>
          <div><strong>This Week:</strong> —</div>
          <div><strong>This Month:</strong> —</div>
        </div>
      </section>

      <section class="modal-section">
        <h3>🎁 Rewards Summary</h3>
        <div class="info-grid">
          <div><strong>Active Points:</strong> —</div>
          <div><strong>Used Points:</strong> —</div>
          <div><strong>Expired Points:</strong> —</div>
          <div><strong>Equivalent:</strong> ₱—</div>
        </div>
      </section>

      <section class="modal-section">
        <h3>🛒 Order Summary</h3>
        <div class="info-grid">
          <div><strong>Lifetime Orders:</strong> —</div>
          <div><strong>This Week:</strong> —</div>
          <div><strong>This Month:</strong> —</div>
          <div><strong>Hold Orders:</strong> —</div>
          <div><strong>Hold Amount:</strong> ₱—</div>
        </div>
      </section>

      <section class="modal-section">
        <h3>📜 Change History</h3>
        <ul class="changelog-list">
          ${
            logs.length
              ? logs.map(log =>
                  `<li>[${log.timestamp}] <strong>${log.field}</strong>: "${log.from}" → "${log.to}"</li>`
                ).join("")
              : "<li>No changes recorded yet.</li>"
          }
        </ul>
      </section>
    `;

    profileModal.classList.add("show");
  } catch (err) {
    console.error("❌ Failed to load customer profile", err);
    alert("Error loading profile.");
  }
}

    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".view-btn");
      if (!btn) return;
      const id = btn.dataset.id;
      openCustomerProfile(id);
    });

    saveProfileBtn.addEventListener("click", async () => {
      const id = profileModal.dataset.customerId;
      if (!id) return;

      const updated = {
        id,
        first_name: document.getElementById("edit-first-name").value.trim(),
        last_name: document.getElementById("edit-last-name").value.trim(),
        email: document.getElementById("edit-email").value.trim(),
        phone: document.getElementById("edit-phone").value.trim(),
        address: document.getElementById("edit-address").value.trim(),
        type: document.getElementById("edit-type").value,
        status: document.getElementById("edit-status").value,
      };

      try {
        await window.api.customers.update(updated);
        alert("✅ Changes saved.");
        profileModal.classList.remove("show");
        await renderCustomersTable();
      } catch (err) {
        console.error("❌ Save failed", err);
        alert("Error saving changes.");
      }
    });

    closeProfileBtn.addEventListener("click", () => {
      profileModal.classList.remove("show");
    });

    // ─────────────────────────────────────────────
    // 🔁 Initial Render
    // ─────────────────────────────────────────────
    renderCustomersTable();
  };

  requestAnimationFrame(waitForRender);
})();
