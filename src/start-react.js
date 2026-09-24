/**
 * Used in dev - polls for create-react-app HMR server readyness,
 * triggers `yarn electron` once react is ready
 */
const net = require("net");
const { spawn } = require("child_process");
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const PORT = process.env.PORT;
let port = 12000;
if (PORT) {
  port = PORT - 100;
}

process.env.ELECTRON_START_URL = `http://127.0.0.1:${port}`;

let startedElectron = false;
let loggedWaiting = false;
const tryConnection = () => {
  // a fresh socket per attempt: reusing one added another "connect" listener
  // on every retry (MaxListenersExceededWarning)
  const client = new net.Socket();
  client.on("error", (e) => {
    client.destroy();
    // ECONNREFUSED just means the react dev server isn't listening yet; say
    // so once instead of printing a stack trace every second
    if (e.code !== "ECONNREFUSED") {
      console.log("error", e);
    } else if (!loggedWaiting) {
      console.log(`waiting for react dev server on port ${port}...`);
      loggedWaiting = true;
    }
    setTimeout(tryConnection, 1000);
  });
  client.connect({ port }, () => {
    client.end();
    if (!startedElectron) {
      console.log(`yarn react:start - react ready on http://127.0.0.1:${port}`);
      console.log("yarn electron:start");
      startedElectron = true;
      let cmd = "yarn";
      if (process.platform === "win32") {
        cmd = "yarn.cmd";
      }
      const appServer = spawn(cmd, ["dev:electron"], {
        cwd: __dirname,
        shell: true,
      });
      appServer.stdout.on("data", (data) => console.log(data.toString()));
      appServer.stderr.on("data", (data) => console.error(data.toString()));
      appServer.on("error", (err) => console.log("FAILED TO SPAWN", err));
    }
  });
};

tryConnection();
