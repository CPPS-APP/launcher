const {app, BrowserWindow, dialog, Menu, MenuItem, screen} = require('electron');
const isDev = require('electron-is-dev');
const isDeveloperBuild = process.env.CPPS_DEV_BUILD === '1' || require('./package.json').cppsAppBuild === 'developer';
const ALLOW_INSECURE = isDeveloperBuild ? true : false;
const insecureLocalHosts = new Set([
    'localhost',
    'media.localhost',
    'play.localhost',
    'secured.localhost'
]);
const {autoUpdater} = require('electron-updater');
const DiscordRPC = require('discord-rpc');
const fs = require('fs');
const path = require('path');

app.on('certificate-error', (event, webContents, url, _error, _certificate, callback) => {
    let hostname;
    try {
        hostname = new URL(url).hostname;
    } catch (_parseError) {
        callback(false);
        return;
    }

    if (ALLOW_INSECURE && insecureLocalHosts.has(hostname)) {
        event.preventDefault();
        callback(true);
        return;
    }

    callback(false);
});

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
let adminWindow;
let fsmenu;
let exitFullscreenMenuItem;
const productionSiteURL = 'https://play.cpps.app/';
const localSiteURL = 'https://play.localhost';
let activeSiteURL = productionSiteURL;
let usingLocalSite = false;
let showingLoadError = false;
let lastWindowedBounds = null;
let windowStateSaveTimer = null;

if (isDeveloperBuild) {
    app.setName('CPPS.APP Desktop Dev');
    app.setPath('userData', path.join(app.getPath('appData'), 'CPPS.APP Desktop Dev'));
}

function showLoadError(errorCode) {
    if (!mainWindow) return;

    const messages = {
        ERR_INTERNET_DISCONNECTED: 'Похоже, интернет-соединение отсутствует.',
        ERR_NAME_NOT_RESOLVED: 'Не удалось найти сервер CPPS.APP.',
        ERR_CONNECTION_TIMED_OUT: 'Сервер не ответил вовремя.',
        ERR_CONNECTION_REFUSED: 'Сервер временно недоступен.'
    };
    const detail = messages[errorCode] || 'Не удалось загрузить CPPS.APP. Проверьте подключение к интернету и попробуйте ещё раз.';
    const html = `<!doctype html>
<html lang="ru">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Не удалось загрузить CPPS.APP</title>
    <style>
        * { box-sizing: border-box; }
        html, body { min-height: 100%; margin: 0; }
        body { min-height: 100vh; display: flex; flex-direction: column; color: #003f72; font: 16px 'proxima_nova_reg', 'Trebuchet MS', Arial, sans-serif; background: linear-gradient(160deg, #4da8da, #1c75b8); }
        header { height: 68px; display: flex; align-items: center; padding: 0 30px; background: #fff; box-shadow: 0 2px 8px rgba(0, 63, 114, .16); }
        .scene { position: relative; flex: 1; display: grid; place-items: center; overflow: hidden; padding: 42px 22px; }
        main { position: relative; width: min(100%, 490px); padding: 40px 42px 36px; text-align: center; background: #fff; border: 1px solid rgba(0,63,114,.12); border-radius: 12px; box-shadow: 0 8px 0 rgba(0,63,114,.12), 0 18px 40px rgba(0,63,114,.2); }
        h1 { margin: 0 0 12px; color: #003f72; font: normal 29px 'proxima_nova_bold', 'Trebuchet MS', Arial, sans-serif; letter-spacing: -.8px; }
        p { margin: 0 auto 26px; max-width: 400px; color: #526b7e; line-height: 1.55; }
        .retry { display: inline-block; min-width: 190px; padding: 12px 22px; border: 1px solid #ff9d00; border-radius: 9px; background: linear-gradient(#ffe477, #ffcc00); box-shadow: inset 0 2px 0 #fff7d7, 0 3px 0 rgba(0,63,114,.17); color: #6e4e00; font: bold 18px 'proxima_nova_bold', 'Trebuchet MS', Arial, sans-serif; text-decoration: none; text-shadow: 0 1px rgba(255,255,255,.5); transition: filter .15s, transform .15s; }
        .retry:hover { filter: brightness(1.04); transform: translateY(-1px); }
        .retry:active { transform: translateY(2px); box-shadow: inset 0 2px 0 #fff7d7, 0 1px 0 rgba(0,63,114,.17); }
        .retry.loading { pointer-events: none; cursor: wait; }
        .retry-spinner { display: none; width: 15px; height: 15px; margin-left: 9px; vertical-align: -2px; border: 2px solid rgba(110,78,0,.28); border-top-color: #6e4e00; border-radius: 50%; }
        .retry.loading .retry-spinner { display: inline-block; animation: retry-spin .7s linear infinite; }
        @keyframes retry-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .retry.loading .retry-spinner { animation-duration: 1.8s; } }
        footer { padding: 14px 20px; background: #003f72; color: rgba(255,255,255,.82); text-align: center; font-size: 12px; }
        @media (max-width: 480px) { header { padding: 0 18px; } main { padding: 34px 24px 30px; } h1 { font-size: 25px; } }
    </style>
</head>
<body>
    <div class="scene">
    <main>
        <h1>Не удалось загрузить страницу!</h1>
        <p>${detail}</p>
        <a class="retry" id="retry-button" href="${activeSiteURL}" aria-live="polite">
            <span id="retry-label">Попробовать снова</span><span class="retry-spinner" aria-hidden="true"></span>
        </a>
    </main>
    </div>
    <script>
        document.getElementById('retry-button').addEventListener('click', function () {
            this.classList.add('loading');
            document.getElementById('retry-label').textContent = 'Подключаемся...';
        });
    </script>
</body>
</html>`;

    showingLoadError = true;
    mainWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
}

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

    if (isDeveloperBuild) {
        appSubmenu.push({
            id: 'toggle-site-environment',
            label: usingLocalSite ? 'Перейти на play.cpps.app' : 'Перейти на play.localhost',
            click: () => toggleSiteEnvironment()
        }, {type: 'separator'});
        appSubmenu.push({
            label: 'admin',
            click: () => openAdminWindow()
        }, {type: 'separator'});
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
            visible: isDeveloperBuild || isDev,
            click: () => {
                const focusedWindow = BrowserWindow.getFocusedWindow();
                if (focusedWindow) focusedWindow.webContents.toggleDevTools();
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
    if (exitFullscreenMenuItem && mainWindow) {
        exitFullscreenMenuItem.visible = mainWindow.isFullScreen();
    }
    Menu.setApplicationMenu(fsmenu);
}

function toggleSiteEnvironment() {
    if (!isDeveloperBuild) return;

    usingLocalSite = !usingLocalSite;
    activeSiteURL = usingLocalSite ? localSiteURL : productionSiteURL;
    makeMenu();
    if (mainWindow) {
        showingLoadError = false;
        mainWindow.loadURL(activeSiteURL);
    }
}

function openAdminWindow() {
    if (adminWindow && !adminWindow.isDestroyed()) {
        adminWindow.focus();
        return;
    }

    adminWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        title: 'Загрузка...',
        icon: path.join(__dirname, 'build/icon.png'),
        backgroundColor: '#22a4f3',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            devTools: isDeveloperBuild || isDev
        }
    });
    adminWindow.loadURL('https://secured.cpps.app/manager');
    adminWindow.on('closed', () => {
        adminWindow = null;
    });
}

function clearCache() {
    if (mainWindow !== null) {
        mainWindow.webContents.session.clearCache();
    }
}

function reloadPage() {
    if (mainWindow !== null) {
        if (showingLoadError) {
            showingLoadError = false;
            mainWindow.loadURL(activeSiteURL);
        } else {
            mainWindow.webContents.reload();
        }
    }
}

function readWindowState() {
    const displays = screen.getAllDisplays();
    const maxWidth = Math.max(...displays.map(display => display.workArea.width));
    const maxHeight = Math.max(...displays.map(display => display.workArea.height));
    const state = {
        width: Math.min(1225, maxWidth),
        height: Math.min(823, maxHeight),
        isMaximized: true
    };

    try {
        const saved = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'window-state.json'), 'utf8'));
        if (Number.isFinite(saved.width) && Number.isFinite(saved.height)
            && saved.width >= 640 && saved.height >= 480) {
            state.width = Math.min(saved.width, maxWidth);
            state.height = Math.min(saved.height, maxHeight);
            state.isMaximized = saved.isMaximized === true;

            if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
                const visibleOnDisplay = displays.some(({workArea}) =>
                    saved.x < workArea.x + workArea.width - 40
                    && saved.x + state.width > workArea.x + 40
                    && saved.y < workArea.y + workArea.height - 40
                    && saved.y + state.height > workArea.y + 40
                );
                if (visibleOnDisplay) {
                    state.x = saved.x;
                    state.y = saved.y;
                }
            }
        }
    } catch (error) {
        if (error.code !== 'ENOENT') console.warn('Could not restore window state:', error);
    }

    return state;
}

function writeWindowState() {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFullScreen()) return;

    const state = {
        ...(lastWindowedBounds || mainWindow.getBounds()),
        isMaximized: mainWindow.isMaximized()
    };

    try {
        fs.writeFileSync(path.join(app.getPath('userData'), 'window-state.json'), JSON.stringify(state));
    } catch (error) {
        console.warn('Could not save window state:', error);
    }
}

function saveWindowState() {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFullScreen()) return;

    if (!mainWindow.isMaximized()) lastWindowedBounds = mainWindow.getBounds();
    if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
    windowStateSaveTimer = setTimeout(() => {
        windowStateSaveTimer = null;
        writeWindowState();
    }, 150);
}

function flushWindowState() {
    if (windowStateSaveTimer) {
        clearTimeout(windowStateSaveTimer);
        windowStateSaveTimer = null;
    }
    writeWindowState();
}

function createWindow() {
    const restoredState = readWindowState();
    const {isMaximized, ...windowBounds} = restoredState;
    lastWindowedBounds = {
        x: restoredState.x,
        y: restoredState.y,
        width: restoredState.width,
        height: restoredState.height
    };

    mainWindow = new BrowserWindow({
        ...windowBounds,
        title: 'Загрузка CPPS.APP...',
        icon: __dirname + '/build/icon.png',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            plugins: true,
            contextIsolation: true,
            nodeIntegration: false,
            devTools: isDeveloperBuild || isDev
        }
    });

    mainWindow.setMenu(null);
    mainWindow.webContents.on('did-fail-load', (event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
        // Ignore aborted navigations (for example, when a redirect replaces the current request).
        if (!isMainFrame || errorCode === -3 || showingLoadError) return;
        console.error(`Failed to load ${validatedURL}: ${errorCode}`);
        showLoadError(errorCode);
    });
    mainWindow.webContents.on('will-navigate', (_event, navigationURL) => {
        if (!navigationURL.startsWith('data:text/html')) showingLoadError = false;
    });
    mainWindow.loadURL(productionSiteURL);

    mainWindow.on('enter-full-screen', () => {
        if (exitFullscreenMenuItem) exitFullscreenMenuItem.visible = true;
    });
    mainWindow.on('leave-full-screen', () => {
        if (exitFullscreenMenuItem) exitFullscreenMenuItem.visible = false;
    });
    mainWindow.on('resize', saveWindowState);
    mainWindow.on('move', saveWindowState);
    mainWindow.on('maximize', saveWindowState);
    mainWindow.on('unmaximize', saveWindowState);
    mainWindow.on('close', flushWindowState);

    if (isMaximized) mainWindow.maximize();

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
