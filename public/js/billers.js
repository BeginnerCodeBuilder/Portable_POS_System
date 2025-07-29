(() => {
  const waitForRender = () => {
    const table = document.getElementById("billersTable");
    const tbody = table?.querySelector("tbody");
    if (!tbody) return requestAnimationFrame(waitForRender);

    console.log("✅ Billers module initialized");

    const searchInput = document.getElementById("searchInput");
    const applyFiltersBtn = document.getElementById("applyFiltersBtn");

    const formatId = (id) => id || "-";

    // 📋 Render Billers Table
    async function renderTable() {
      const search = searchInput.value.trim().toLowerCase();
      const billers = await window.api.billers.getAll({ search });

      tbody.innerHTML = "";
      const noData = document.getElementById("noDataMessage");
      if (!billers.length) {
        noData.classList.remove("hidden");
        return;
      }
      noData.classList.add("hidden");

      for (const b of billers) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${formatId(b.biller_id)}</td>
          <td>${b.company_name}</td>
          <td>${b.phone}</td>
          <td>${b.email || "-"}</td>
          <td>${b.address || "-"}</td>
          <td>${b.primary_contact_name || "-"}</td>
          <td>${b.primary_contact_mobile || "-"}</td>
          <td>${b.status}</td>
          <td><button class="view-btn" data-id="${b.biller_id}">View</button></td>
        `;
        tbody.appendChild(row);
      }
    }

    applyFiltersBtn.addEventListener("click", renderTable);

    // ➕ Add Biller Modal
    const addModal = document.getElementById("biller-modal");
    document.getElementById("addBillerBtn").addEventListener("click", () => {
      addModal.classList.remove("hidden");
    });

    document.getElementById("btn-cancel-biller").addEventListener("click", () => {
      addModal.classList.add("hidden");
    });

    document.getElementById("btn-save-biller").addEventListener("click", async () => {
      const data = {
        company_name: document.getElementById("biller-company-name").value.trim(),
        email: document.getElementById("biller-email").value.trim(),
        phone: document.getElementById("biller-phone").value.trim(),
        address: document.getElementById("biller-address").value.trim(),
        status: document.getElementById("biller-status").value || "Active",
      };

      if (!data.company_name || !data.phone || !data.address) {
        alert("Please fill in all required fields.");
        return;
      }

      try {
        const result = await window.api.billers.add(data);
        if (result.biller_id) {
          alert("✅ Biller added.");
          addModal.classList.add("hidden");
          renderTable();
        } else {
          throw new Error("No biller_id returned");
        }
      } catch (err) {
        alert("❌ Failed to add biller.");
        console.error(err);
      }
    });

    // 📥 Import Billers
    document.getElementById("importBillersBtn").addEventListener("click", async () => {
      const { canceled, filePaths } = await window.api.billers.pickFile();
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
        const result = await window.api.billers.import(filePath);
        alert(`✅ Imported: ${result.added}, Skipped: ${result.skipped}`);
        renderTable();
      } catch (err) {
        alert("❌ Import failed: " + err.message);
      }
    });

    // 📤 Export Billers
    document.getElementById("exportBillersBtn").addEventListener("click", async () => {
      try {
        await window.api.billers.export();
        alert("✅ Export successful.");
      } catch (err) {
        alert("❌ Export failed.");
      }
    });

    // 📂 View Profile Modal
    const profileModal = document.getElementById("biller-profile-modal");
    const profileContent = profileModal.querySelector(".modal-content");
    const profileHeader = profileModal.querySelector("h2");

    async function openBillerProfile(biller_id) {
      try {
        const biller = await window.api.billers.getOne(biller_id);
        const contacts = await window.api.billers.getContacts(biller_id);
        const logs = await window.api.billers.getLogs(biller_id);

        profileModal.dataset.billerId = biller_id;
        profileHeader.textContent = `Biller Profile — ${biller.company_name}`;

        const createField = (label, id, value = "", type = "text", disabled = true) =>
          `<div><strong>${label}</strong><input type="${type}" id="${id}" value="${value}" ${disabled ? "disabled" : ""}></div>`;

        profileContent.innerHTML = `
          <section class="modal-section">
            <h3>🏢 Biller Details</h3>
            <div class="info-grid">
              <div><strong>Biller ID:</strong> ${biller.biller_id}</div>
              ${createField("Company Name:", "edit-company-name", biller.company_name)}
              ${createField("Email:", "edit-email", biller.email || "", "email")}
              ${createField("Phone:", "edit-phone", biller.phone)}
              ${createField("Address:", "edit-address", biller.address)}
              <div><strong>Status:</strong>
                <select id="edit-status" disabled>
                  ${["Active", "Archived"].map(s => `
                    <option value="${s}" ${biller.status === s ? "selected" : ""}>${s}</option>
                  `).join("")}
                </select>
              </div>
            </div>
          </section>

          <section class="modal-section">
            <h3>👥 Contact Persons</h3>
            <table class="contact-table">
              <thead>
                <tr><th>Name</th><th>Mobile</th><th>Status</th><th>Position</th></tr>
              </thead>
              <tbody>
                ${contacts.map(c => `
                  <tr>
                    <td><input type="text" value="${c.name}" data-id="${c.id}" class="contact-name"></td>
                    <td><input type="text" value="${c.mobile}" data-id="${c.id}" class="contact-phone"></td>
                    <td>
                      <select class="contact-status" data-id="${c.id}">
                        ${["Active", "Separated"].map(status => `
                          <option value="${status}" ${c.status === status ? "selected" : ""}>${status}</option>
                        `).join("")}
                      </select>
                    </td>
                    <td>
                      <select class="contact-position" data-id="${c.id}">
                        ${["Primary", "Secondary"].map(pos => `
                          <option value="${pos}" ${c.position === pos ? "selected" : ""}>${pos}</option>
                        `).join("")}
                      </select>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </section>

          <section class="modal-section">
            <h3>📜 Change Logs</h3>
            <ul class="changelog-list">
              ${logs.length ? logs.map(log => `
                <li>[${log.timestamp}] ${log.entity}: "${log.field}" — ${log.from_val} → ${log.to_val}</li>
              `).join("") : "<li>No logs yet.</li>"}
            </ul>
          </section>

          <div class="modal-actions">
            <button id="editBillerBtn" class="primary-button">Edit</button>
            <button id="saveBillerBtn" class="primary-button hidden">Save</button>
          </div>
        `;

        profileModal.classList.add("show");

        document.getElementById("editBillerBtn").addEventListener("click", () => {
          ["edit-company-name", "edit-email", "edit-phone", "edit-address", "edit-status"]
            .forEach(id => document.getElementById(id).disabled = false);
          document.getElementById("saveBillerBtn").classList.remove("hidden");
        });

        document.getElementById("saveBillerBtn").addEventListener("click", async () => {
          const updated = {
            biller_id: biller_id,
            company_name: document.getElementById("edit-company-name").value.trim(),
            email: document.getElementById("edit-email").value.trim(),
            phone: document.getElementById("edit-phone").value.trim(),
            address: document.getElementById("edit-address").value.trim(),
            status: document.getElementById("edit-status").value,
          };
          await window.api.billers.update(updated);

          // Update Contacts
          const contactInputs = [...document.querySelectorAll(".contact-name")];
          for (const input of contactInputs) {
            const contact_id = input.dataset.id;
            const name = input.value.trim();
            const phone = document.querySelector(`.contact-phone[data-id="${contact_id}"]`).value.trim();
            const status = document.querySelector(`.contact-status[data-id="${contact_id}"]`).value;
            const position = document.querySelector(`.contact-position[data-id="${contact_id}"]`).value;

            await window.api.billers.updateContacts({
              contact_id,
              biller_id,
              name,
              mobile: phone,
              status,
              position,
            });
          }

          alert("✅ Biller updated.");
          profileModal.classList.remove("show");
          renderTable();
        });

      } catch (err) {
        alert("❌ Failed to load biller.");
        console.error(err);
      }
    }

    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".view-btn");
      if (btn) openBillerProfile(btn.dataset.id);
    });

    document.querySelector("#biller-profile-modal .close-button").addEventListener("click", () => {
      profileModal.classList.remove("show");
    });

    renderTable();
  };

  requestAnimationFrame(waitForRender);
})();
