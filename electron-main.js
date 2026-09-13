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

  const windowUrl = new URL(url);
  windowUrl.searchParams.set("desktop", "1");
  mainWindow.loadURL(windowUrl.href);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  localServer = startServer(5177, {
    openBrowser: false,
    onReady: ({ server, url }) => {
      localServer = server;
      createWindow(url);
    },
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
      onReady: ({ server, url }) => {
        localServer = server;
        createWindow(url);
      },
    });
  }
});
