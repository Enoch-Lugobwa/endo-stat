const { app, dialog, shell, ipcMain, BrowserWindow } = require('electron')
const { autoUpdater } = require('electron-updater')
const unhandled = require('electron-unhandled')
const Store = require('electron-store')
const fetch = require('node-fetch')
const path = require('path')

// Handle unhandled errors
unhandled()

const store = new Store({ encryptionKey: 'encryption-key-here' })
const accountId = '17203fc8-25f0-40ea-abc3-e4037a3cc3f5'
const productId = '7a205a04-485b-4cf9-af8b-b0093f59a248'
const isDev = process.env.NODE_ENV === 'development'

store.set('app.version', app.getVersion())

async function validateLicenseKey(key) {
  const response = await fetch(`https://api.keygen.sh/v1/accounts/${accountId}/licenses/actions/validate-key`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      meta: {
        scope: { product: productId },
        key,
      },
    }),
  })

  const { meta, data, errors } = await response.json()
  if (errors) {
    return { status: response.status, errors }
  }

  return { status: response.status, meta, data }
}

async function gateAppLaunchWithLicense(appLauncher) {
  const gateWindow = new BrowserWindow({
    resizable: false,
    frame: false,
    width: 420,
    height: 200,
    webPreferences: {
      preload: path.join(__dirname, 'gate.js'),
      devTools: isDev,
    },
  })

  gateWindow.loadFile('gate.html')
  if (isDev) gateWindow.webContents.openDevTools({ mode: 'detach' })

  ipcMain.on('GATE_SUBMIT', async (_event, { key }) => {
    const res = await validateLicenseKey(key)

    if (res.errors) {
      const [{ code }] = res.errors
      const choice = await dialog.showMessageBox(gateWindow, {
        type: 'error',
        title: 'Invalid License',
        message: 'The license key you entered is invalid. Would you like to try again or buy one?',
        detail: `Error code: ${code ?? res.status}`,
        buttons: ['Continue evaluation', 'Try again', 'Buy a license'],
      })

      switch (choice.response) {
        case 0:
          store.set('app.mode', 'EVALUATION')
          store.delete('license')
          gateWindow.close()
          appLauncher(key)
          break
        case 1:
          break
        case 2:
          shell.openExternal('https://keygen.sh/for-electron-apps/')
          break
      }

      return
    }

    const { valid, code } = res.meta
    const license = res.data

    if (['VALID', 'EXPIRED'].includes(code)) {
      store.set('license', {
        key: license.attributes.key,
        expiry: license.attributes.expiry,
        status: code,
        lastValidation: Date.now(),
      })
      store.set('app.mode', 'LICENSED')

      await dialog.showMessageBox(gateWindow, {
        type: valid ? 'info' : 'warning',
        title: 'License Accepted',
        message: `License ID: ${license.id.slice(0, 8)} — ${code.toLowerCase()}`,
        detail: valid ? 'Automatic updates are enabled.' : 'Automatic updates are disabled.',
        buttons: ['Continue'],
      })

      gateWindow.close()
      appLauncher(license.attributes.key)
    } else {
      store.set('app.mode', 'UNLICENSED')
      store.delete('license')

      await dialog.showMessageBox(gateWindow, {
        type: 'error',
        title: 'License Rejected',
        message: 'Your license is no longer valid.',
        detail: `Validation code: ${code}`,
        buttons: ['Exit'],
      })

      app.exit(1)
    }
  })
}

function launchAppWithLicenseKey(key) {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev,
    },
  })

  mainWindow.loadFile('index.html')

  if (!isDev) {
    autoUpdater.addAuthHeader(`License ${key}`)
    autoUpdater.checkForUpdatesAndNotify()
    setInterval(autoUpdater.checkForUpdatesAndNotify, 1000 * 60 * 60 * 3) // every 3 hours
  }
}

app.whenReady().then(async () => {
  const stored = store.get('license')
  if (stored?.key) {
    const lastChecked = stored.lastValidation || 0
    const now = Date.now()

    // Revalidate every 24 hours
    if (now - lastChecked < 1000 * 60 * 60 * 24) {
      launchAppWithLicenseKey(stored.key)
      return
    }

    const res = await validateLicenseKey(stored.key)
    if (res.meta && ['VALID', 'EXPIRED'].includes(res.meta.code)) {
      store.set('license.lastValidation', now)
      launchAppWithLicenseKey(stored.key)
      return
    } else {
      store.delete('license')
      store.set('app.mode', 'UNLICENSED')
    }
  }

  gateAppLaunchWithLicense(launchAppWithLicenseKey)
})

app.on('window-all-closed', () => app.quit())
