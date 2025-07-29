// File: public/js/customers.js
(() => {
  const waitForRender = () => {
    const table = document.getElementById("customersTable");
    const tbody = table?.querySelector("tbody");
    if (!tbody) return requestAnimationFrame(waitForRender);

    console.log("✅ Customers module initialized");

    // 🧩 Utility
    const formatCurrency = (val) => `₱${(+val).toFixed(2)}`;

    // 🧾 Filters
    function getFilters() {
      const filters = {};
      if (document.getElementById("typeFilterCheckbox").checked)
        filters.type = document.getElementById("typeFilterSelect").value;

      if (document.getElementById("statusFilterCheckbox").checked)
        filters.status = document.getElementById("statusFilterSelect").value;

      const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();
      const searchMode = document.getElementById("searchMode").value;
      if (searchTerm) filters.searchTerm = searchTerm;
      if (searchMode) filters.searchMode = searchMode;

      return filters;
    }

    // 📋 Render Table
    async function renderTable() {
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
        const rewards = await window.api.customers.getRewardsSummary(c.id);
        const activePts = rewards.active_points ?? 0;
        const equivalent = formatCurrency(rewards.active_equivalent ?? 0);

        row.innerHTML = `
          <td>${c.custom_id}</td>
          <td>${fullName}</td>
          <td>${c.phone}</td>
          <td>${c.address}</td>
          <td>${c.type}</td>
          <td>${c.status}</td>
          <td class="points" title="${equivalent}">${activePts}</td>
          <td><button class="view-btn" data-id="${c.id}">View</button></td>
        `;
        tbody.appendChild(row);
      }
    }

    // 🔍 Filters
    document.getElementById("applyFiltersBtn").addEventListener("click", renderTable);
    document.getElementById("typeFilterCheckbox").addEventListener("change", (e) => {
      document.getElementById("typeFilterSelect").disabled = !e.target.checked;
    });
    document.getElementById("statusFilterCheckbox").addEventListener("change", (e) => {
      document.getElementById("statusFilterSelect").disabled = !e.target.checked;
    });

    // ➕ Add Customer Modal
    const addModal = document.getElementById("customer-modal");
    document.getElementById("addCustomerBtn").addEventListener("click", () => addModal.classList.remove("hidden"));
    document.getElementById("btn-cancel-customer").addEventListener("click", () => addModal.classList.add("hidden"));
    document.getElementById("btn-save-customer").addEventListener("click", async () => {
      const data = {
        first_name: document.getElementById("add-first-name").value.trim(),
        last_name: document.getElementById("add-last-name").value.trim(),
        email: document.getElementById("add-email").value.trim(),
        phone: document.getElementById("add-phone").value.trim(),
        address: document.getElementById("add-address").value.trim(),
        type: document.getElementById("add-type").value,
        status: document.getElementById("add-status").value,
      };

      if (!data.first_name || !data.phone || !data.address) {
        alert("Please fill in all required fields.");
        return;
      }

      const result = await window.api.customers.add(data);
      if (result.success) {
        alert("✅ Customer added.");
        addModal.classList.add("hidden");
        renderTable();
      } else {
        alert("❌ Failed to add customer.");
      }
    });

    // 📥 Import
    document.getElementById("importCustomersBtn").addEventListener("click", async () => {
      const { canceled, filePaths } = await window.api.customers.pickFile();
      if (canceled || !filePaths.length) return;

      const filePath = filePaths[0];
      const basket = document.getElementById("importFileBasket");
      basket.classList.remove("hidden");
      basket.innerHTML = `<span>${filePath}</span><span class="remove-file" id="removeImportFileBtn">🗑️</span>`;

      document.getElementById("removeImportFileBtn").addEventListener("click", () => {
        basket.classList.add("hidden");
        basket.innerHTML = "";
      });

      try {
        const result = await window.api.customers.import(filePath);
        alert(`✅ Imported: ${result.imported}, Updated: ${result.updated}, Skipped: ${result.skipped}`);
        renderTable();
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    });

    // 📤 Export
    document.getElementById("exportCustomersBtn").addEventListener("click", async () => {
      try {
        await window.api.customers.export();
        alert("✅ Export successful.");
      } catch (err) {
        alert("❌ Export failed.");
      }
    });

    // 🔍 View/Edit Profile Modal
    const profileModal = document.getElementById("customer-profile-modal");
    const profileHeader = profileModal.querySelector("h2");
    const profileContent = profileModal.querySelector(".modal-content");

    async function openCustomerProfile(id) {
      const customer = await window.api.customers.getOne(id);
      const rewards = await window.api.customers.getRewardsSummary(id);
      const logs = await window.api.customers.getLogs(id);

      profileHeader.textContent = `Customer Profile — ${customer.first_name} ${customer.last_name || ""}`;
      profileModal.dataset.customerId = id;

      const createField = (label, id, value = "", type = "text", disabled = true) =>
        `<div><strong>${label}</strong><input type="${type}" id="${id}" value="${value}" ${disabled ? "disabled" : ""}></div>`;

      profileContent.innerHTML = `
        <section class="modal-section">
          <h3>👤 Basic Info</h3>
          <div class="info-grid">
            <div><strong>Customer ID:</strong> ${customer.custom_id}</div>
            ${createField("First Name:", "edit-first-name", customer.first_name)}
            ${createField("Last Name:", "edit-last-name", customer.last_name || "")}
            ${createField("Email:", "edit-email", customer.email || "", "email")}
            ${createField("Mobile:", "edit-phone", customer.phone)}
            ${createField("Address:", "edit-address", customer.address)}
            <div><strong>Type:</strong>
              <select id="edit-type" disabled>
                ${["Regular", "VIP", "Gold", "Silver", "Wholesaler"].map(type => `
                  <option value="${type}" ${customer.type === type ? "selected" : ""}>${type}</option>
                `).join("")}
              </select>
            </div>
            <div><strong>Status:</strong>
              <select id="edit-status" disabled>
                ${["Active", "Suspended"].map(status => `
                  <option value="${status}" ${customer.status === status ? "selected" : ""}>${status}</option>
                `).join("")}
              </select>
            </div>
            <div><strong>Date Joined:</strong> ${customer.date_joined}</div>
            <div><strong>Active Points:</strong> ${rewards.active_points || 0} (${formatCurrency(rewards.active_equivalent)})</div>
          </div>
        </section>

        <section class="modal-section">
          <h3>💰 Sales Summary</h3>
          <div class="info-grid"><div>Lifetime Sales:</div><div>—</div></div>
        </section>

        <section class="modal-section">
          <h3>🎁 Rewards Summary</h3>
          <div class="info-grid">
            <div><strong>Earned:</strong> ${rewards.earned_points} (${formatCurrency(rewards.earned_equivalent)})</div>
            <div><strong>Redeemed:</strong> ${rewards.redeemed_points} (${formatCurrency(rewards.redeemed_equivalent)})</div>
            <div><strong>Expired:</strong> ${rewards.expired_points} (${formatCurrency(rewards.expired_equivalent)})</div>
          </div>
          <button id="goRewardsBtn" class="primary-button">Go to Rewards Ledger</button>
        </section>

        <section class="modal-section">
          <h3>🛒 Order Summary</h3>
          <div class="info-grid"><div>—</div></div>
          <button id="goOrdersBtn" class="primary-button">Go to Orders</button>
        </section>

        <section class="modal-section">
          <h3>📜 Change History</h3>
          <ul class="changelog-list">
            ${logs.length ? logs.map(l => `
              <li>[${l.timestamp}] ${l.field}: "${l.from}" → "${l.to}"</li>
            `).join("") : "<li>No logs yet.</li>"}
          </ul>
        </section>

        <div class="modal-actions">
          <button id="editCustomerBtn" class="primary-button">Edit</button>
          <button id="saveCustomerBtn" class="primary-button hidden">Save</button>
        </div>
      `;

      profileModal.classList.add("show");

      document.getElementById("editCustomerBtn").addEventListener("click", () => {
        ["edit-first-name", "edit-last-name", "edit-email", "edit-phone", "edit-address", "edit-type", "edit-status"]
          .forEach(id => document.getElementById(id).disabled = false);
        document.getElementById("saveCustomerBtn").classList.remove("hidden");
      });

      document.getElementById("saveCustomerBtn").addEventListener("click", async () => {
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
        await window.api.customers.update(updated);
        alert("✅ Customer updated.");
        profileModal.classList.remove("show");
        renderTable();
      });

      document.getElementById("goRewardsBtn").addEventListener("click", () => {
  const customId = customer.custom_id; // not customer.id
  window.location.href = `pages/rewards-ledger.html?customer_id=${encodeURIComponent(customId)}`;
});



      document.getElementById("goOrdersBtn").addEventListener("click", () => {
        window.location.href = `orders.html?customer_id=${id}`;
      });
    }

    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".view-btn");
      if (btn) openCustomerProfile(btn.dataset.id);
    });

    document.querySelector("#customer-profile-modal .close-button").addEventListener("click", () => {
      profileModal.classList.remove("show");
    });

    renderTable();
  };

  requestAnimationFrame(waitForRender);
})();
