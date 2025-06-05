const {app, BrowserWindow, dialog, Menu, MenuItem} = require('electron');
const isDev = require('electron-is-dev');
const {autoUpdater} = require('electron-updater');
const DiscordRPC = require('discord-rpc');
const fs = require('fs');
const path = require('path');

function isOSWin64() {
    return process.arch === 'x64' || process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
}

let pluginName
switch (process.platform) {
    case 'win32':
        switch (process.arch) {
            case 'ia32':
            case 'x32':
                pluginName = 'flash/windows/32/pepflashplayer.dll'
                break
            case 'x64':
                pluginName = 'flash/windows/64/pepflashplayer.dll'
                break
        }
        break
    case 'linux':
        switch (process.arch) {
            case 'ia32':
            case 'x32':
                pluginName = 'flash/linux/32/libpepflashplayer.so'
                break
            case 'x64':
                pluginName = 'flash/linux/64/libpepflashplayer.so'
                break
        }

        app.commandLine.appendSwitch('no-sandbox');
        break
    case 'darwin':
        pluginName = 'flash/mac/PepperFlashPlayer.plugin'
        break
}
app.commandLine.appendSwitch('ppapi-flash-path', path.join(__dirname, pluginName));
//app.commandLine.appendSwitch('proxy-server', '127.0.0.1:8080');
//app.commandLine.appendSwitch("disable-http-cache");

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let fsmenu;

function makeMenu() {
    fsmenu = new Menu();
    fsmenu.append(new MenuItem({
        label: 'На полный экран',
        accelerator: 'F11',
        click: () => {
            let fsbool = (mainWindow.isFullScreen() ? false : true);
            mainWindow.setFullScreen(fsbool);
        }
    }));
    fsmenu.append(new MenuItem({
        label: 'Отключить/включить звук',
        click: () => {
            let ambool = (mainWindow.webContents.audioMuted ? false : true);
            mainWindow.webContents.audioMuted = ambool;
        }
    }));
    fsmenu.append(new MenuItem({
        label: 'Очистить кэш',
        accelerator: 'CmdOrCtrl+D',
        click: () => {
            clearCache();
        }
    }));
    fsmenu.append(new MenuItem({
        label: 'Обновить страницу',
        accelerator: 'F5',
        click: () => {
            reloadPage();
        }
    }));
    // fsmenu.append(new MenuItem({
    //   label: 'Инструменты разработчика',
    // accelerator: 'F12',
    //   click: () => {
    //     mainWindow.webContents.toggleDevTools();
    //   }
    // }));
    fsmenu.append(new MenuItem({
        label: '', // Exit full screen
        visible: false,
        accelerator: 'Escape',
        click: () => {
            mainWindow.setFullScreen(false);
            mainWindow.setMenuBarVisibility(true);
        }
    }));
}

function clearCache() {
    if (mainWindow !== null) {
        mainWindow.webContents.session.clearCache();
    }
}

function reloadPage() {
    if (mainWindow !== null) {
        mainWindow.webContents.reload();
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1225,
        height: 823,
        title: 'Загрузка CPPS.APP...',
        icon: __dirname + '/build/icon.png',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            plugins: true
        }
    });

    mainWindow.setMenu(null);
    mainWindow.loadURL('https://play.cpps.app/#/login');

    const clientId = '1098494702644383766';
    DiscordRPC.register(clientId);
    const rpc = new DiscordRPC.Client({transport: 'ipc'});
    const startTimestamp = new Date();
    rpc.on('ready', () => {
        rpc.setActivity({
            details: `Клуб Пингвинов`,
            state: `Приватный Сервер`,
            startTimestamp,
            largeImageKey: `main-logo`
        });
    });
    rpc.login({clientId}).catch(console.error);

    //mainWindow.webContents.openDevTools();

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', function () {
    createWindow();
    makeMenu();
    Menu.setApplicationMenu(fsmenu);
});

app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});
