(() => {
  const waitForRender = () => {
    const promoTypeSelect = document.getElementById("promo-type");

    if (!promoTypeSelect) {
      requestAnimationFrame(waitForRender);
      return;
    }

    console.log("✅ DOM is ready — initializing Promos module");

    // 🔹 Elements
    const ruleFields = document.getElementById("rule-fields");
    const generateCodeBtn = document.getElementById("btn-generate-promo");
    const promoCodeInput = document.getElementById("promo-code");
    const saveBtn = document.getElementById("btn-save-promo");
    const promosTableBody = document.querySelector("#promos-table-wrapper tbody");

    const editModal = document.getElementById("edit-modal");
    const editCode = document.getElementById("edit-code");
    const editStart = document.getElementById("edit-start");
    const editEnd = document.getElementById("edit-end");
    const editMax = document.getElementById("edit-max");
    const editStatus = document.getElementById("edit-status");
    const editNote = document.getElementById("edit-note");
    const editSaveBtn = document.getElementById("btn-edit-save");
    const editCancelBtn = document.getElementById("btn-edit-cancel");

    // 🔹 Helpers
    const resetRuleFields = () => {
      ruleFields.innerHTML = "";
    };

    const renderRuleFields = () => {
      resetRuleFields();
      const type = promoTypeSelect.value;

      switch (type) {
        case "Fixed Discount":
          ruleFields.innerHTML = `
            <label>₱ Discount Amount
              <input type="number" id="amount" class="medium-input" min="1" step="0.01">
            </label>`;
          break;
        case "Percentage Discount":
          ruleFields.innerHTML = `
            <label>Discount % (1-100)
              <input type="number" id="percent" class="medium-input" min="1" max="100">
            </label>`;
          break;
        case "Free Item":
          ruleFields.innerHTML = `
            <label>Item ID
              <input type="text" id="item-id" class="medium-input" maxlength="6">
            </label>
            <label>Description
              <input type="text" id="description" class="medium-input">
            </label>`;
          break;
        case "Buy X Get Y - Free":
        case "Buy X Get Y - ₱ Off":
        case "Buy X Get Y - % Off":
          ruleFields.innerHTML = `
            <label>Buy: Item/Group ID
              <input type="text" id="buy-id" class="medium-input" maxlength="6">
            </label>
            <label>Buy Quantity
              <input type="number" id="buy-qty" class="medium-input" min="1">
            </label>
            <label>Get: Item/Group ID
              <input type="text" id="get-id" class="medium-input" maxlength="6">
            </label>
            <label>Get Quantity
              <input type="number" id="get-qty" class="medium-input" min="1">
            </label>` +
            (type === "Buy X Get Y - ₱ Off"
              ? `<label>₱ Discount
                   <input type="number" id="buyget-amount" class="medium-input" min="1" step="0.01">
                 </label>`
              : type === "Buy X Get Y - % Off"
              ? `<label>% Discount
                   <input type="number" id="buyget-percent" class="medium-input" min="1" max="100">
                 </label>`
              : "");
          break;
      }
    };

    const generatePromoCode = () => {
      const code = Math.random().toString(36).substr(2, 15).toUpperCase();
      promoCodeInput.value = code;
      console.log("✅ Generated:", code);
    };

    const getPromoStatus = (start, end) => {
      const today = new Date().toISOString().split("T")[0];
      if (start > today) return "Scheduled";
      if (end && end < today) return "Expired";
      return "Active";
    };

    const renderTable = async () => {
      try {
        const rows = await window.api.getPromos({ search: "", status: "All" });
        promosTableBody.innerHTML = "";

        rows.forEach(row => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${row.code}</td>
            <td>${row.type}</td>
            <td>${row.rule_summary}</td>
            <td>${row.start_date}</td>
            <td>${row.end_date || "-"}</td>
            <td>${row.status}</td>
            <td>${row.redemptions}/${row.max_redemptions || "-"}</td>
            <td>${row.note || "-"}</td>
            <td><button class="short-button edit-btn" data-code="${row.code}">Edit</button></td>
          `;
          promosTableBody.appendChild(tr);
        });

        // Bind edit buttons
        document.querySelectorAll(".edit-btn").forEach(btn => {
          btn.addEventListener("click", (e) => {
            const row = e.target.closest("tr");
            editCode.value = row.children[0].textContent;
            editStart.value = row.children[3].textContent;
            editEnd.value = row.children[4].textContent !== "-" ? row.children[4].textContent : "";
            editStatus.value = row.children[5].textContent;
            const [used, max] = row.children[6].textContent.split("/");
            editMax.value = max !== "-" ? max : "";
            editNote.value = row.children[7].textContent !== "-" ? row.children[7].textContent : "";
            editModal.classList.remove("hidden");
          });
        });
      } catch (err) {
        console.error("❌ Failed to fetch promos:", err);
      }
    };

    // 🔹 Save promo button
    saveBtn.addEventListener("click", async () => {
      const promo = {
        code: promoCodeInput.value.trim(),
        type: promoTypeSelect.value,
        start_date: document.getElementById("promo-start").value,
        end_date: document.getElementById("promo-end").value || null,
        max_redemptions: document.getElementById("max-redemptions").value || null,
        note: document.getElementById("promo-note").value,
        rule: {}
      };

      if (!promo.code || !promo.type || !promo.start_date) {
        alert("Please fill in required fields.");
        return;
      }

      // Build dynamic rule
      switch (promo.type) {
        case "Fixed Discount":
          promo.rule.amount = parseFloat(document.getElementById("amount").value);
          break;
        case "Percentage Discount":
          promo.rule.percent = parseFloat(document.getElementById("percent").value);
          break;
        case "Free Item":
          promo.rule.item_id = document.getElementById("item-id").value;
          promo.rule.description = document.getElementById("description").value;
          break;
        default:
          promo.rule.buy = {
            id: document.getElementById("buy-id").value,
            qty: parseInt(document.getElementById("buy-qty").value),
          };
          promo.rule.get = {
            id: document.getElementById("get-id").value,
            qty: parseInt(document.getElementById("get-qty").value),
          };
          if (promo.type === "Buy X Get Y - ₱ Off") {
            promo.rule.amount = parseFloat(document.getElementById("buyget-amount").value);
          } else if (promo.type === "Buy X Get Y - % Off") {
            promo.rule.percent = parseFloat(document.getElementById("buyget-percent").value);
          }
          break;
      }

      switch (promo.type) {
        case "Fixed Discount":
          promo.rule_summary = `₱${promo.rule.amount.toFixed(2)} off`;
          break;
        case "Percentage Discount":
          promo.rule_summary = `${promo.rule.percent}% off`;
          break;
        case "Free Item":
          promo.rule_summary = `Free: ${promo.rule.item_id} - ${promo.rule.description}`;
          break;
        default:
          const buy = `${promo.rule.buy.qty} x ${promo.rule.buy.id}`;
          const get = `${promo.rule.get.qty} x ${promo.rule.get.id}`;
          if (promo.type === "Buy X Get Y - Free") {
            promo.rule_summary = `Buy ${buy}, Get ${get} Free`;
          } else if (promo.type === "Buy X Get Y - ₱ Off") {
            promo.rule_summary = `Buy ${buy}, Get ${get} ₱${promo.rule.amount.toFixed(2)} Off`;
          } else if (promo.type === "Buy X Get Y - % Off") {
            promo.rule_summary = `Buy ${buy}, Get ${get} ${promo.rule.percent}% Off`;
          }
          break;
      }

      promo.status = getPromoStatus(promo.start_date, promo.end_date);

      console.log("📦 Saving promo:", promo);

      try {
        await window.api.savePromo(promo);
        alert("✅ Promo saved successfully.");
        renderTable();
      } catch (err) {
        console.error("❌ Save failed", err);
        alert(err.message || "Error saving promo.");
      }
    });

    // 🔹 Edit modal actions
    editCancelBtn.addEventListener("click", () => {
      editModal.classList.add("hidden");
    });

    editSaveBtn.addEventListener("click", async () => {
      const payload = {
        code: editCode.value,
        start_date: editStart.value,
        end_date: editEnd.value || null,
        max_redemptions: editMax.value || null,
        note: editNote.value || null,
        status: editStatus.value
      };

      try {
        await window.api.updatePromo(payload);
        alert("✅ Promo updated.");
        editModal.classList.add("hidden");
        renderTable();
      } catch (err) {
        console.error("❌ Update failed", err);
        alert("Failed to update promo.");
      }
    });

    // 🔹 Init
    promoTypeSelect.addEventListener("change", renderRuleFields);
    generateCodeBtn.addEventListener("click", generatePromoCode);
    renderTable();
  };

  requestAnimationFrame(waitForRender);
})();
