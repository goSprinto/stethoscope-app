import { Menu, shell, clipboard } from "electron";
import axios from "axios";
import pkg from "../package.json";
import config from "./config.json";
import AutoLauncher from "./AutoLauncher";

export default function (mainWindow, app, focusOrCreateWindow, updater, log) {
  const { checkForUpdates } = updater;
  const autoLauncher = new AutoLauncher();

  const contextMenu = [
    { role: "copy", accelerator: "CmdOrCtrl+C" },
    {
      label: "Window",
      submenu: [
        { role: "reload" },
        { role: "close", accelerator: "CmdOrCtrl+W" },
        {
          label: "Open Window",
          accelerator: "CmdOrCtrl+N",
          click() {
            mainWindow = focusOrCreateWindow(mainWindow);
          },
        },
      ],
    },
    {
      id: "autolaunch",
      label: "Launch on Startup",
      submenu: [
        {
          id: "autolaunchOn",
          label: "On",
          type: "checkbox",
          click: (menuItem, _, event) => {
            autoLauncher.enable(app);
            menuItem.menu.items[0].checked = true; // Update checkbox UI
            menuItem.menu.items[1].checked = false; // Uncheck the "Off" option

            menuItem.menu.items[0].enabled = false; // Uncheck the "enable" option
            menuItem.menu.items[1].enabled = true; // Uncheck the "enable" option
            // Your code to handle the "On" option
          },
          enabled: !autoLauncher.isEnabled(),
          // Set initial checkbox value based on AutoLauncher state
          checked: autoLauncher.isEnabled(),
        },
        {
          id: "autolaunchOff",
          label: "Off",
          enabled: autoLauncher.isEnabled(),
          checked: !autoLauncher.isEnabled(),
          // Set initial checkbox value based on AutoLauncher state
          type: "checkbox",
          click: (menuItem, _, event) => {
            autoLauncher.disable(app);
            menuItem.menu.items[0].checked = false; // Uncheck the "On" option
            menuItem.menu.items[1].checked = true; // Update checkbox UI

            menuItem.menu.items[0].enabled = true; // Uncheck the "enable" option
            menuItem.menu.items[1].enabled = false; // Uncheck the "enable" option
            // Your code to handle the "Off" option
          },
        },
      ],
    },
    {
      label: "Check for Update",
      click(event) {
        checkForUpdates(this, mainWindow, event);
      },
    },
    { role: "separator", enabled: false },
  ].concat(
    {
      label: "Help",
      submenu: config.menu.help
        .map(({ label, link }) => ({
          label,
          click() {
            shell.openExternal(link);
          },
        }))
        .concat(
          {
            label: `${app.name} version ${pkg.version}`,
            enabled: false,
          },
          {
            label: "Copy Debug Info",
            click() {
              axios
                .get("http://127.0.0.1:37370/debugger", {
                  headers: {
                    Origin: `${app.name.toLowerCase()}://main`,
                  },
                })
                .then((res) => clipboard.writeText(res.data));
            },
          },
          {
            label: "Disconnect",
            click() {
              axios
                .post(
                  "http://127.0.0.1:37370/disconnect",
                  {},
                  {
                    headers: {
                      Origin: `${app.name.toLowerCase()}://main`,
                    },
                  }
                )
                .then((res) => {
                  console.log("Response from disconnect", res.data);
                })
                .catch((err) => {
                  console.log("error Response from disconnect", err);
                });
            },
          }
        ),
    },
    { role: "separator", enabled: false }
  );

  if (process.env.STETHOSCOPE_ENV === "development") {
    contextMenu.push({
      role: "toggleDevTools",
      accelerator: "Alt+CmdOrCtrl+I",
    });
  }

  contextMenu.push({ role: "quit", accelerator: "CmdOrCtrl+Q" });

  const applicationMenu = Menu.buildFromTemplate(
    [
      {
        label: app.name,
        submenu: [
          {
            label: `${app.name} version ${pkg.version}`,
            enabled: false,
          },
          // {
          //   label: 'Check for Update',
          //   click (event) {
          //     checkForUpdates(this, mainWindow, event)
          //   }
          // },
          { role: "copy", accelerator: "CmdOrCtrl+C" },
          { role: "quit", accelerator: "CmdOrCtrl+Q" },
        ],
      },
    ].concat(contextMenu)
  );

  // Left side main menu
  Menu.setApplicationMenu(applicationMenu);

  // Rigth click menu
  const contextMenuInstance = Menu.buildFromTemplate(contextMenu);
  return contextMenuInstance;
}
