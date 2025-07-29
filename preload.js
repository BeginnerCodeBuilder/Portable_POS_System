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
    getAll: () => ipcRenderer.invoke("customers:get-all"),
    add: (data) => ipcRenderer.invoke("customers:add", data),
    update: (data) => ipcRenderer.invoke("customers:update", data),
    getLogs: (id) => ipcRenderer.invoke("customers:get-logs", id),
    import: (filePath) => ipcRenderer.invoke("customers:import", filePath),
    export: () => ipcRenderer.invoke("customers:export"),
    pickFile: () => ipcRenderer.invoke("dialog:openFile"),
    getRewardsSummary: (id) => ipcRenderer.invoke("customers:get-rewards-summary", id),

    // ✅ ADD THIS LINE:
    getOne: (id) => ipcRenderer.invoke("customers:get-one", id),
  },

  billers: {
  getAll: (filters) => ipcRenderer.invoke("billers:get-all", filters),
  add: (data) => ipcRenderer.invoke("billers:add", data),
  update: (data) => ipcRenderer.invoke("billers:update", data),
  getOne: (id) => ipcRenderer.invoke("billers:get-one", id),
  getLogs: (id) => ipcRenderer.invoke("billers:get-logs", id),
  getContacts: (billerId) => ipcRenderer.invoke("billers:get-contacts", billerId),
  updateContacts: (biller_id, contacts) => ipcRenderer.invoke("billers:update-contacts", { biller_id, contacts }),
  import: (filePath) => ipcRenderer.invoke("billers:import", filePath),
  export: () => ipcRenderer.invoke("billers:export"),
  pickFile: () => ipcRenderer.invoke("billers:pickFile")
},

});
