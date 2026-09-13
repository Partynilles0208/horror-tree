const { app, BrowserWindow } = require("electron");
const { startServer } = require("./server");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

let mainWindow = null;
let localServer = null;

function createWindow(url) {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: "#000000",
    title: "Horror Tree",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`${url}&desktop=1`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  localServer = startServer(5177, {
    openBrowser: false,
    onReady: ({ url }) => createWindow(url),
  });
});

app.on("window-all-closed", () => {
  if (localServer) localServer.close();
  app.quit();
});

app.on("activate", () => {
  if (!mainWindow) {
    localServer = startServer(5177, {
      openBrowser: false,
      onReady: ({ url }) => createWindow(url),
    });
  }
});
