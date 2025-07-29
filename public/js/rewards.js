(() => {
  const earnRule = document.getElementById("earn-rule");
  const conditionalFields = document.getElementById("conditional-fields");
  const generateIdBtn = document.getElementById("btn-generate-id");
  const rewardsIdInput = document.getElementById("rewards-id");
  const saveRewardBtn = document.getElementById("btn-save-reward");
  const conversionBtn = document.getElementById("btn-set-conversion");
  const conversionModal = document.getElementById("conversion-modal");
  const confirmConversionBtn = document.getElementById("btn-confirm-conversion");
  const cancelConversionBtn = document.getElementById("btn-cancel-conversion");

  const renderTable = async () => {
    const tbody = document.querySelector(".rewards-table tbody");
    const rows = await window.api.getAllRewardRules();
    tbody.innerHTML = "";

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="no-data">No reward rules found.</td></tr>`;
      return;
    }

    for (const row of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.id}</td>
        <td>${row.rule}</td>
        <td>${row.points || '-'}</td>
        <td>${row.start_date}</td>
        <td>${row.end_date || '-'}</td>
        <td>${row.status}</td>
        <td>${row.note || '-'}</td>
        <td><button class="edit-btn" data-id="${row.id}">Edit</button></td>
      `;
      tbody.appendChild(tr);
    }

    document.querySelectorAll(".edit-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const rule = rows.find(r => r.id === btn.dataset.id);
        if (!rule) return;

        document.getElementById("edit-id").value = rule.id;
        document.getElementById("edit-start-date").value = rule.start_date;
        document.getElementById("edit-end-date").value = rule.end_date || "";
        document.getElementById("edit-status").value = rule.status;
        document.getElementById("edit-note").value = rule.note || "";
        document.getElementById("edit-modal").classList.remove("hidden");
      });
    });
  };

  earnRule.addEventListener("change", () => {
    const selected = earnRule.value;
    conditionalFields.innerHTML = "";

    if (selected === "Amount") {
      conditionalFields.innerHTML = `
        <label>Min Spend
          <input type="number" id="min-spend" class="medium-input" min="0">
        </label>
        <label>Points Earned
          <input type="number" id="points-earned" class="medium-input" min="1">
        </label>
      `;
    } else if (selected === "Item" || selected === "Group") {
      conditionalFields.innerHTML = `
        <label>Reference Code
          <input type="text" id="reference-code" class="medium-input">
        </label>
        <label>Points Earned
          <input type="number" id="points-earned" class="medium-input" min="1">
        </label>
      `;
    } else if (selected === "Customer") {
      conditionalFields.innerHTML = `
        <label>Customer ID
          <input type="text" id="customer-id" class="medium-input">
        </label>
        <label>Points Earned
          <input type="number" id="points-earned" class="medium-input" min="1">
        </label>
      `;
    }
  });

  generateIdBtn.addEventListener("click", () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    rewardsIdInput.value = `RW-${timestamp.slice(-6)}`;
  });

  conversionBtn.addEventListener("click", () => conversionModal.classList.remove("hidden"));
  cancelConversionBtn.addEventListener("click", () => conversionModal.classList.add("hidden"));

  confirmConversionBtn.addEventListener("click", () => {
    const points = document.getElementById("conversion-points").value;
    const peso = document.getElementById("conversion-peso").value;

    if (!points || !peso || points <= 0 || peso <= 0) {
      alert("Please enter valid conversion values.");
      return;
    }

    const data = {
      points: parseInt(points),
      peso: parseFloat(peso),
      date: new Date().toISOString()
    };

    window.api.saveConversionRate(data).then(() => {
      const formattedDate = new Date(data.date).toLocaleDateString("en-PH", {
        year: "numeric", month: "long", day: "2-digit"
      });
      document.getElementById("conversion-text").textContent = `${data.points} Points = ₱${data.peso.toFixed(2)} as of ${formattedDate}`;
      conversionModal.classList.add("hidden");
    });
  });

  saveRewardBtn.addEventListener("click", () => {
    const reward = {
      id: rewardsIdInput.value.trim(),
      rule: earnRule.value,
      start_date: document.getElementById("start-date").value,
      end_date: document.getElementById("end-date").value || null,
      note: document.getElementById("note").value,
      status: "Active"
    };

    if (!reward.id || !reward.rule || !reward.start_date) {
      alert("Please fill in all required fields except end date (optional).");
      return;
    }

    if (reward.rule === "Amount") {
      reward.min_spend = parseFloat(document.getElementById("min-spend").value);
      reward.points = parseInt(document.getElementById("points-earned").value);
    } else if (["Item", "Group"].includes(reward.rule)) {
      reward.reference_code = document.getElementById("reference-code").value;
      reward.points = parseInt(document.getElementById("points-earned").value);
    } else if (reward.rule === "Customer") {
      reward.customer_id = document.getElementById("customer-id").value;
      reward.points = parseInt(document.getElementById("points-earned").value);
    }

    window.api.saveRewardRule(reward).then(() => {
      alert("Reward rule saved successfully.");
      location.reload();
    });
  });

  // EDIT modal save
  document.getElementById("btn-edit-save").addEventListener("click", () => {
    const updated = {
      id: document.getElementById("edit-id").value,
      start_date: document.getElementById("edit-start-date").value,
      end_date: document.getElementById("edit-end-date").value || null,
      status: document.getElementById("edit-status").value,
      note: document.getElementById("edit-note").value
    };

    if (!updated.id || !updated.start_date || !updated.status) {
      alert("Please complete all required fields.");
      return;
    }

    window.api.updateRewardRule(updated).then(() => {
      document.getElementById("edit-modal").classList.add("hidden");
      renderTable();
    });
  });

  document.getElementById("btn-edit-cancel").addEventListener("click", () => {
    document.getElementById("edit-modal").classList.add("hidden");
  });

  const renderLatestConversion = async () => {
  const latest = await window.api.getLatestConversionRate();
  const conversionText = document.getElementById("conversion-text");

  if (latest) {
    const formattedDate = new Date(latest.date).toLocaleDateString("en-PH", {
      year: "numeric", month: "long", day: "2-digit"
    });
    conversionText.textContent = `${latest.points} Points = ₱${latest.peso.toFixed(2)} as of ${formattedDate}`;
  } else {
    conversionText.textContent = "No conversion rate as of the moment. Please generate.";
  }
};

  // 📤 Export rewards CSV
  document.getElementById("btn-export-rewards").addEventListener("click", async () => {
    try {
      const csv = await window.api.exportRewards();

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      const now = new Date();
      const timestamp = now.toISOString().split("T")[0];
      a.href = url;
      a.download = `rewards_export_${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export rewards. Please try again.");
    }
  });

  renderTable();
  renderLatestConversion();
})();
