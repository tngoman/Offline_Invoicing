const setupEvents = require('./setupEvents')
 if (setupEvents.handleSquirrelEvent()) {
    return;
 }
 

const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path')
const DownloadManager = require("electron-download-manager");


let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 1200,
    frame: false,
    minWidth: 1200, 
    minHeight: 750,
    webPreferences: {
      nodeIntegration: true,
      plugins: true,
      webviewTag: true
    },
    
  });


  
  mainWindow.maximize();
  mainWindow.show();

  mainWindow.loadURL(
    `file://${path.join(__dirname, 'index.html')}`
  )

  mainWindow.on('closed', () => {
    mainWindow = null
  });
  
}


app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

DownloadManager.register({
    downloadFolder: app.getPath("downloads") + "/OfflineInvoicing"
});


ipcMain.on('app-quit', (evt, arg) => {
  app.quit()
})


ipcMain.on('app-reload', (event, arg) => {
  mainWindow.reload();
});
 
 