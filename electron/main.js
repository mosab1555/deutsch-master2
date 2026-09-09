/* Deutsch Master - Windows shell (loads the unchanged site) */
const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    title: "Deutsch Master",
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: "#070b18",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "client", "icons", "icon-256.png")
  });
  win.loadFile(path.join(__dirname, "..", "client", "index.html"));
}

app.whenReady().then(function () {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
