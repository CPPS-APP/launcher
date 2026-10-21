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
let exitFullscreenMenuItem;

function makeMenu() {
    const isMac = process.platform === 'darwin';
    const appSubmenu = [];

    if (isMac) {
        appSubmenu.push(
            {role: 'about', label: 'О программе CPPS.APP'},
            {type: 'separator'},
            {role: 'services', label: 'Службы'},
            {type: 'separator'},
            {role: 'hide', label: 'Скрыть CPPS.APP'},
            {role: 'hideOthers', label: 'Скрыть остальные'},
            {role: 'unhide', label: 'Показать все'},
            {type: 'separator'},
            {role: 'quit', label: 'Выйти из CPPS.APP'},
            {type: 'separator'}
        );
    }

    appSubmenu.push(
        {
            label: 'На полный экран',
            accelerator: 'F11',
            click: () => {
                if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
        },
        {
            label: 'Отключить/включить звук',
            click: () => {
                if (mainWindow) {
                    const contents = mainWindow.webContents;
                    contents.setAudioMuted(!contents.isAudioMuted());
                }
            }
        },
        {
            label: 'Очистить кэш',
            accelerator: 'CmdOrCtrl+D',
            click: () => clearCache()
        },
        {
            label: 'Обновить страницу',
            accelerator: 'F5',
            click: () => reloadPage()
        },
        {
            label: 'Инструменты разработчика',
            accelerator: 'F12',
            click: () => {
                if (mainWindow) mainWindow.webContents.toggleDevTools();
            }
        },
        {
            id: 'exit-fullscreen',
            label: 'Выйти из полноэкранного режима',
            accelerator: 'Escape',
            visible: false,
            click: () => {
                if (mainWindow) mainWindow.setFullScreen(false);
            }
        }
    );

    if (!isMac) {
        appSubmenu.push(
            {type: 'separator'},
            {role: 'quit', label: 'Выход'}
        );
    }

    const template = [
        {
            label: 'CPPS.APP',
            submenu: appSubmenu
        },
        {
            label: 'Правка',
            submenu: [
                {role: 'undo', label: 'Отменить', accelerator: 'CmdOrCtrl+Z'},
                {role: 'redo', label: 'Повторить', accelerator: 'Shift+CmdOrCtrl+Z'},
                {type: 'separator'},
                {role: 'cut', label: 'Вырезать', accelerator: 'CmdOrCtrl+X'},
                {role: 'copy', label: 'Копировать', accelerator: 'CmdOrCtrl+C'},
                {role: 'paste', label: 'Вставить', accelerator: 'CmdOrCtrl+V'},
                {role: 'selectAll', label: 'Выделить всё', accelerator: 'CmdOrCtrl+A'}
            ]
        }
    ];

    if (isMac) {
        template.push(
            {
                label: 'Окно',
                submenu: [
                    {role: 'minimize', label: 'Свернуть'},
                    {role: 'zoom', label: 'Увеличить'},
                    {type: 'separator'},
                    {role: 'front', label: 'На передний план'}
                ]
            }
        );
    }

    fsmenu = Menu.buildFromTemplate(template);
    exitFullscreenMenuItem = fsmenu.getMenuItemById('exit-fullscreen');
    Menu.setApplicationMenu(fsmenu);
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
            plugins: true,
            contextIsolation: true,
            nodeIntegration: false,
            devTools: isDev
        }
    });

    mainWindow.setMenu(null);
    mainWindow.loadURL('https://play.cpps.app/');

    mainWindow.on('enter-full-screen', () => {
        if (exitFullscreenMenuItem) exitFullscreenMenuItem.visible = true;
    });
    mainWindow.on('leave-full-screen', () => {
        if (exitFullscreenMenuItem) exitFullscreenMenuItem.visible = false;
    });

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
