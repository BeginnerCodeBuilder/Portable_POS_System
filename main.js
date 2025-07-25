// File: main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Route handlers
const RewardsRoutes = require('./brain/rewards.routes');
const VouchersRoutes = require('./brain/vouchers.routes');
const PromosRoutes = require('./brain/promos.routes');
const InventoryRoutes = require('./brain/inventory.routes');
const SuppliersRoutes = require('./brain/suppliers.routes');
const RewardsLedgerRoutes = require('./brain/rewards.ledger.routes');
const CustomersRoutes = require('./brain/customers.routes'); // ✅ Customers module

let splashWindow;
let mainWindow;

function createWindows() {
  // Splash screen
  splashWindow = new BrowserWindow({
    width: 500,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: true,
  });

  splashWindow.loadFile(path.join(__dirname, 'public/splash.html'));

  // Main app window
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    resizable: false,
    show: false, // wait for splash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'public/index.html'));

  setTimeout(() => {
    splashWindow.close();
    mainWindow.show();
  }, 2000); // Show main window after splash
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData');
  const memoryPath = path.join(userDataPath, 'Portable_POS_System', 'memory');
  const dbFile = path.join(memoryPath, 'main.db');

  if (!fs.existsSync(memoryPath)) fs.mkdirSync(memoryPath, { recursive: true });
  if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, '');

  // 🧠 Rewards IPC
  ipcMain.handle('save-reward-rule', (_, data) => RewardsRoutes.saveRewardRule(data));
  ipcMain.handle('get-all-reward-rules', () => RewardsRoutes.getAllRewardRules());
  ipcMain.handle('update-reward-rule', (_, data) => RewardsRoutes.updateRewardRule(data));
  ipcMain.handle('save-conversion-rate', (_, data) => RewardsRoutes.saveConversionRate(data));
  ipcMain.handle('get-latest-conversion-rate', () => RewardsRoutes.getLatestConversionRate());
  ipcMain.handle('export-rewards', () => RewardsRoutes.exportRewards());

  // 🧠 Vouchers IPC
  ipcMain.handle('save-vouchers', (_, data) => VouchersRoutes.saveVouchers(data));
  ipcMain.handle('get-vouchers', (_, filters) => VouchersRoutes.getVouchers(filters));
  ipcMain.handle('update-voucher', (_, data) => VouchersRoutes.updateVoucher(data));
  ipcMain.handle('get-voucher-summary', () => VouchersRoutes.getVoucherSummary());
  ipcMain.handle('export-vouchers', (_, filters) => VouchersRoutes.exportVouchers(filters));
  ipcMain.handle('import-vouchers', (_, rows) => VouchersRoutes.importVouchers(rows));

  // 🧠 Promos IPC
  ipcMain.handle('save-promo', (_, data) => PromosRoutes.savePromo(data));
  ipcMain.handle('get-promos', (_, filters) => PromosRoutes.getPromos(filters));
  ipcMain.handle('update-promo', (_, data) => PromosRoutes.updatePromo(data));
  ipcMain.handle('export-promos', () => PromosRoutes.exportPromos());
  ipcMain.handle('import-promos', (_, rows) => PromosRoutes.importPromos(rows));
  ipcMain.handle('get-promo-stats', () => PromosRoutes.getPromoStats());
  ipcMain.handle('record-redemption', (_, data) => PromosRoutes.recordRedemption(data));

  // 🧠 Inventory IPC
  ipcMain.handle("inventory:get-groups", () => InventoryRoutes.getItemGroups());
  ipcMain.handle("inventory:add-group", (_, data) => InventoryRoutes.addGroup(data));
  ipcMain.handle("inventory:update-group", (_, data) => InventoryRoutes.updateGroup(data));
  ipcMain.handle("inventory:delete-group", (_, id) => InventoryRoutes.deleteGroup(id));
  ipcMain.handle("inventory:get-items", (_, filters) => InventoryRoutes.getItems(filters));
  ipcMain.handle("inventory:add-item", (_, item) => InventoryRoutes.addItem(item));
  ipcMain.handle("inventory:update-item", (_, item) => InventoryRoutes.updateItem(item));
  ipcMain.handle("inventory:delete-item", (_, id) => InventoryRoutes.deleteItem(id));
  ipcMain.handle("inventory:import-items", (_, rows) => InventoryRoutes.importItems(rows));
  ipcMain.handle("inventory:export-items", () => InventoryRoutes.exportItems());

// 🔹 SUPPLIERS — IPC Handlers ✅ NEW
ipcMain.handle("suppliers:get-all", () => SuppliersRoutes.getAll());
ipcMain.handle("suppliers:add", (_, data) => SuppliersRoutes.add(data));
ipcMain.handle("suppliers:update", (_, data) => SuppliersRoutes.update(data));
ipcMain.handle("suppliers:import", (_, rows) => SuppliersRoutes.import(rows));
ipcMain.handle("suppliers:export", () => SuppliersRoutes.export());

// 🧠 Rewards Ledger IPC
ipcMain.handle("rewards-ledger:get", (_, filters) => RewardsLedgerRoutes.getLedger(filters));
ipcMain.handle("rewards-ledger:add", (_, data) => RewardsLedgerRoutes.addEntry(data));
ipcMain.handle("rewards-ledger:update-notes", (_, { id, notes }) => RewardsLedgerRoutes.updateNotes(id, notes));
ipcMain.handle("rewards-ledger:export", (_, filters) => RewardsLedgerRoutes.exportLedger(filters));

const CustomersRoutes = require('./brain/customers.routes'); // ✅ Add this if missing

// 🧠 Customers IPC
ipcMain.handle("customers:add", (_, data) => CustomersRoutes.addCustomer(data));
ipcMain.handle("customers:update", (_, data) => CustomersRoutes.updateCustomer(data));
ipcMain.handle("customers:getAll", (_, filters) => CustomersRoutes.getAllCustomers(filters));
ipcMain.handle("customers:import", (_, rows) => CustomersRoutes.importCustomers(rows));
ipcMain.handle("customers:export", () => CustomersRoutes.exportCustomers());
ipcMain.handle("customers:logs", (_, id) => CustomersRoutes.getCustomerLog(id));

// ✅ File Picker (for import)
const { dialog } = require('electron');
ipcMain.handle("file:pick", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select Customer CSV File",
    filters: [{ name: "CSV Files", extensions: ["csv"] }],
    properties: ["openFile"]
  });
  return result;
});
 createWindows();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindows();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
