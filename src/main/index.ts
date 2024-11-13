import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { localServer } from './localServer'
import server from './api/index.cjs'
import { browserICP } from './ipcMain'
import Store from './store'
import { createTray } from './tray'
const store = new Store()
server.listen(25976, '127.0.0.1')
localServer.listen(26485, '127.0.0.1')
function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    // transparent: true,
    // show: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      partition: 'persist:mySession'
    }
  })
  browserICP(mainWindow, store)
  createTray(mainWindow)
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  //歌词窗口
  let lyricWindow: BrowserWindow | undefined
  mainWindow.on('close', () => {
    if (!lyricWindow?.isDestroyed()) lyricWindow?.close()
  })
  ipcMain.on('open-lyric', (_event: any) => {
    lyricWindow = new BrowserWindow({
      width: 900,
      height: 200,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        webSecurity: false,
        partition: 'persist:mySession'
      }
    })
    lyricWindow.loadURL('http://localhost:26485/lyric')
    //转发歌词
    lyricWindow.on('ready-to-show', () => {
      lyricWindow?.show()
      //移动到选项的时候解锁锁定
      ipcMain.on('lyric-window-options-state', (_event: any, lock: boolean) => {
        lyricWindow?.setIgnoreMouseEvents(lock, {
          forward: true
        })
      })
      //更新歌词
      ipcMain.on('update-lyric', (_event: any, data: any) => {
        lyricWindow?.webContents.send('update-lyric', data)
      })
      //主窗口解锁/锁定歌词
      ipcMain.on('lock-lyric', (_event: any, lock: boolean) => {
        lyricWindow?.setIgnoreMouseEvents(lock, {
          forward: true
        })
        lyricWindow?.webContents.send('lock-lyric', lock)
      })
      //歌词窗口解锁/锁定歌词
      ipcMain.on('lyric-window-lock-lyric', (_event: any, lock: boolean) => {
        lyricWindow?.setIgnoreMouseEvents(lock, {
          forward: true
        })
        mainWindow.webContents.send('lyric-window-lock-lyric', lock)
      })
      //关闭歌词
      ipcMain.on('close-lyric', (_event: any) => {
        if (!lyricWindow?.isDestroyed()) lyricWindow?.close()
      })
      //主窗口更改播放状态
      ipcMain.on('play-state', (_event: any, play: boolean) => {
        if (lyricWindow?.isDestroyed()) return
        lyricWindow?.webContents.send('play-state', play)
      })
      //歌词窗口更改播放状态
      ipcMain.on('lyric-window-play-state', (_event: any, play: boolean) => {
        mainWindow.webContents.send('lyric-window-play-state', play)
      })

      //歌词窗口上一首
      ipcMain.on('lyric-window-pre-track', (_event: any) => {
        mainWindow.webContents.send('pre-song')
      })
      //歌词窗口下一首
      ipcMain.on('lyric-window-next-track', (_event: any) => {
        mainWindow.webContents.send('next-song')
      })
      mainWindow.webContents.send('lyric-ready')
    })
    lyricWindow.on('close', () => {
      mainWindow.webContents.send('close-lyric')
      lyricWindow?.webContents.removeAllListeners()
      ipcMain.removeAllListeners('update-lyric')
      ipcMain.removeAllListeners('lock-lyric')
      ipcMain.removeAllListeners('close-lyric')
      ipcMain.removeAllListeners('lyric-window-lock')
      ipcMain.removeAllListeners('lyric-window-pre-track')
      ipcMain.removeAllListeners('lyric-window-next-track')
    })
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadURL('http://localhost:26485')
    // mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
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

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
