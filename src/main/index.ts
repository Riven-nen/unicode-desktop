import { app, shell, BrowserWindow, clipboard, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerDiagnosticsHandlers } from './diagnostics'
import { registerFsHandlers } from './fs'
import { registerHtmlPreviewHandlers, stopAllPreviews } from './htmlPreview'
import { registerJudge0Handlers } from './judge0'
import { registerPythonLspHandlers, stopPythonLsp } from './pythonLsp'
import { cleanupSubmissionRuns, registerTerminalHandlers, stopAllTerminals } from './terminal'
import { registerToolchainHandlers } from './toolchains'

function createWindow(): void {
  // Create the browser window. The native title bar is hidden — the renderer
  // draws its own themed controls (see TitleBarControls.tsx) and the nav bar
  // is a drag region. macOS keeps its native traffic lights with this style.
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 720,
    minHeight: 480,
    show: false,
    // Demo branch: open the desktop app fullscreen for recording.
    fullscreen: true,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Preload only uses contextBridge + ipcRenderer, so the renderer can
      // stay sandboxed. Clipboard and shell access go through main.
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Keep the renderer's maximize/restore button in sync with the window state.
  const broadcastMaximizeState = (): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-changed', mainWindow.isMaximized())
    }
  }
  mainWindow.on('maximize', broadcastMaximizeState)
  mainWindow.on('unmaximize', broadcastMaximizeState)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows (must match electron-builder's appId).
  electronApp.setAppUserModelId('com.unicodelab.desktop')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Workspace file access (open/save course files on disk).
  registerFsHandlers()

  // Loopback static server for the HTML playground preview.
  registerHtmlPreviewHandlers()

  // Clipboard + external links. Kept in main so the renderer/preload can run
  // with the Chromium sandbox enabled.
  ipcMain.handle('clipboard:read-text', () => clipboard.readText())
  ipcMain.handle('clipboard:write-text', (_event, text: string) => {
    clipboard.writeText(text)
  })
  ipcMain.handle('app:open-external', async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) links can be opened.')
    await shell.openExternal(url)
  })

  // Judge0 execution (professor test runner), isolated in the main process.
  registerJudge0Handlers()

  // Local PowerShell session for the student terminal.
  registerTerminalHandlers()

  // Compiler/runtime discovery for the file-open check.
  registerToolchainHandlers()

  // Local compiler diagnostics for Java and C/C++ files.
  registerDiagnosticsHandlers()

  // Bundled Pyright language server (completion, hover, definitions, diagnostics).
  registerPythonLspHandlers()

  // Custom title-bar window controls.
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle('window:is-maximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopAllTerminals()
  cleanupSubmissionRuns()
  stopPythonLsp()
  stopAllPreviews()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
