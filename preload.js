// File: preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 🔹 Rewards
  saveRewardRule: (data) => ipcRenderer.invoke('save-reward-rule', data),
  getAllRewardRules: () => ipcRenderer.invoke('get-all-reward-rules'),
  updateRewardRule: (data) => ipcRenderer.invoke('update-reward-rule', data),
  saveConversionRate: (data) => ipcRenderer.invoke('save-conversion-rate', data),
  getLatestConversionRate: () => ipcRenderer.invoke('get-latest-conversion-rate'),
  exportRewards: () => ipcRenderer.invoke('export-rewards'),

  // 🔹 Vouchers
  saveVouchers: (data) => ipcRenderer.invoke('save-vouchers', data),
  getVouchers: (filters) => ipcRenderer.invoke('get-vouchers', filters),
  updateVoucher: (data) => ipcRenderer.invoke('update-voucher', data),
  getVoucherSummary: () => ipcRenderer.invoke('get-voucher-summary'),
  exportVouchers: (filters) => ipcRenderer.invoke('export-vouchers', filters),
  importVouchers: (rows) => ipcRenderer.invoke('import-vouchers', rows),

  // 🔹 Promos
  savePromo: (data) => ipcRenderer.invoke('save-promo', data),
  getPromos: (filters) => ipcRenderer.invoke('get-promos', filters),
  updatePromo: (data) => ipcRenderer.invoke('update-promo', data),
  exportPromos: () => ipcRenderer.invoke('export-promos'),
  importPromos: (rows) => ipcRenderer.invoke('import-promos', rows),
  getPromoStats: () => ipcRenderer.invoke('get-promo-stats'),
  recordRedemption: (data) => ipcRenderer.invoke('record-redemption', data),

  // 🔹 Inventory
  inventory: {
    getGroups: () => ipcRenderer.invoke("inventory:get-groups"),
    addGroup: (group) => ipcRenderer.invoke("inventory:add-group", group),
    updateGroup: (group) => ipcRenderer.invoke("inventory:update-group", group),
    deleteGroup: (id) => ipcRenderer.invoke("inventory:delete-group", id),

    getItems: (filters) => ipcRenderer.invoke("inventory:get-items", filters),
    addItem: (item) => ipcRenderer.invoke("inventory:add-item", item),
    updateItem: (item) => ipcRenderer.invoke("inventory:update-item", item),
    deleteItem: (id) => ipcRenderer.invoke("inventory:delete-item", id),

    importItems: (rows) => ipcRenderer.invoke("inventory:import-items", rows),
    exportItems: () => ipcRenderer.invoke("inventory:export-items"),
  },

  // 🔹 Suppliers ✅ NEW
  suppliers: {
    getAll: () => ipcRenderer.invoke("suppliers:get-all"),
    add: (data) => ipcRenderer.invoke("suppliers:add", data),
    update: (data) => ipcRenderer.invoke("suppliers:update", data),
    delete: (id) => ipcRenderer.invoke("suppliers:delete", id),
    import: (rows) => ipcRenderer.invoke("suppliers:import", rows),
    export: () => ipcRenderer.invoke("suppliers:export"),
  },

    // 🔹 Rewards Ledger APIs
  rewardsLedger: {
    get: (filters) => ipcRenderer.invoke("rewards-ledger:get", filters),
    add: (data) => ipcRenderer.invoke("rewards-ledger:add", data),
    updateNotes: (id, notes) => ipcRenderer.invoke("rewards-ledger:update-notes", { id, notes }),
    export: (filters) => ipcRenderer.invoke("rewards-ledger:export", filters),
  },

  customers: {
    add: (data) => ipcRenderer.invoke("customers:add", data),
    update: (data) => ipcRenderer.invoke("customers:update", data),
    getAll: (filters) => ipcRenderer.invoke("customers:getAll", filters),
    import: (rows) => ipcRenderer.invoke("customers:import", rows),
    export: () => ipcRenderer.invoke("customers:export"),
    getLogs: (id) => ipcRenderer.invoke("customers:logs", id),
    pickFile: () => ipcRenderer.invoke("file:pick") // ✅ required for import modal
  },


});
