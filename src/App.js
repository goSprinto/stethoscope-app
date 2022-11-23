/* global Notification */
import React, { Component } from "react";
import Stethoscope from "./lib/Stethoscope";
import Device from "./Device";
import Loader from "./Loader";
// import Footer from './Footer'
import DownloadProgress from "./DownloadProgress";
import openSocket from "socket.io-client";
import moment from "moment";
import classNames from "classnames";
import serializeError from "serialize-error";
import { HOST } from "./constants";
import appConfig from "./config.json";
import pkg from "../package.json";
import ErrorMessage from "./ErrorMessage";
import yaml from "js-yaml";
import "./App.css";
import ConnectToSprintoApp from "./components/ConnectToSprintoApp";

const socket = openSocket(HOST);

// CRA doesn't like importing native node modules
// have to use window.require AFAICT
const os = window.require("os");
const glob = window.require("glob");
const { readFileSync } = window.require("fs");
const path = window.require("path");
const { shell, ipcRenderer } = window.require("electron");
const Store = window.require("electron-store");
const remote = window.require("@electron/remote");
const log = remote.getGlobal("log");
const platform = os.platform();

const appName = ipcRenderer.sendSync("get:app:name");
const settings = new Store({ name: "settings" });

class App extends Component {
  state = {
    device: {},
    policy: {},
    result: {},
    instructions: {},
    scanIsRunning: false,
    loading: true,
    lastScanDuration: 0,
    deviceLogLastReportedOn: new Date(),
    // determines loading screen wording
    remoteScan: false,
    // surface which app performed the most recent scan
    scannedBy: appName,
    lastScanTime: Date.now(),
    // whether app currently has focus
    focused: true,
    // progress object from updater process { percent, total, transferred }
    downloadProgress: null,
    // whether rescan button should be highlighted
    highlightRescan: false,

    // new states
    showActionDescription: false,
    actionDescription: null,
    actionButtonTitle: "Scan",
    enableReportNow: true,
    countDown: 10,
    myInterval: null,
    // auth related states
    isConnected: false,
    firstName: null,
    policyLastSyncedOn: null,
  };

  componentWillUnmount = () => {
    this.setState({ scanIsRunning: false });
    clearInterval(this.myInterval);
    clearInterval(this.myInterval2);
  };

  async componentDidMount() {
    // append app version to title
    document.querySelector("title").textContent += ` (v${pkg.version})`;

    const deviceLogLastReportedOnTS = await settings.get(
      "deviceLogLastReportedOn"
    );

    const deviceLogLastReportedOn = deviceLogLastReportedOnTS
      ? new Date(deviceLogLastReportedOnTS)
      : null;

    // To sync policy once every day
    const policyLastSyncedOnTs = await settings.get("policyLastSyncedOn");

    const policyLastSyncedOn = policyLastSyncedOnTs
      ? new Date(policyLastSyncedOnTs)
      : null;

    this.setState({
      recentHang: settings.get("recentHang", 0) > 1,
      deviceLogLastReportedOn,
      policyLastSyncedOn,
      isConnected: settings.get("isConnected", false),
      firstName: settings.get("firstName", null),
    });

    // check if policy sync required (once per day)
    if (this.shouldPolicySync(policyLastSyncedOn)) {
      await this.syncUpdatedPolicy();
    }

    ipcRenderer.send("scan:init");

    // perform the initial policy load & scan
    try {
      await this.loadPractices();
    } catch (e) {
      console.error("Unable to load practices");
    }
    // flag ensures the download:start event isn't sent multiple times
    this.downloadStartSent = false;
    // handle context menu
    window.addEventListener("contextmenu", () =>
      ipcRenderer.send("contextmenu")
    );
    // handle App update download progress
    ipcRenderer.on("download:progress", this.onDownloadProgress);
    // handles any errors that occur when updating (restores window size, etc.)
    ipcRenderer.on("download:error", this.onDownloadError);
    // trigger scan from main process
    ipcRenderer.on("autoscan:start", (args = {}) => {
      // const { notificationOnViolation = false } = args
      if (!this.state.scanIsRunning) {
        ipcRenderer.send("scan:init");
        if (Object.keys(this.state.policy).length) {
          this.handleScan();
        } else {
          this.loadPractices();
        }
      }
    });
    // the server emits this event when a remote scan begins
    socket.on("scan:init", this.onScanInit);
    // setup a socket io listener to refresh the app when a scan is performed
    socket.on("scan:complete", this.onScanComplete);
    socket.on("scan:error", this.onScanError);
    socket.on("sprinto:devicelogrecorded", this.onDeviceLogRecorded);

    // Handler for device connected / registered from sprinto account
    socket.on("sprinto:deviceConnected", this.onDeviceConnected);
    // handler for device disconnected or deregister from sprinto account
    socket.on("sprinto:deviceDisconnected", this.onDeviceDisconnected);

    // the focus/blur handlers are used to update the last scanned time
    window.addEventListener("focus", () => this.setState({ focused: true }));
    window.addEventListener("blur", () => this.setState({ focused: false }));
    document.addEventListener("dragover", (event) => event.preventDefault());
    document.addEventListener("drop", (event) => event.preventDefault());

    this.myInterval = setInterval(() => {
      if (this.remainingTimeInMinute() <= 10) {
        this.setState({
          countDown: 10 - this.remainingTimeInMinute(),
          actionButtonTitle: "Scan",
          enableReportNow: true,
        });
      }

      if (this.remainingTimeInMinute() > 10) {
        this.setState({
          countDown: 10,
          actionButtonTitle: "Re-Scan",
          enableReportNow: false,
        });
        clearInterval(this.myInterval);
      }
    }, 60000);
  }

  shouldPolicySync = (policyLastSyncedOn) => {
    // we will sync policy once per day

    const policySyncFreqDays = 1;

    if (policyLastSyncedOn === null && this.state.isConnected === true) {
      return true;
    }

    const today = new Date();
    const daysSincePolicySync = policyLastSyncedOn
      ? Math.round(
          (today.getTime() - policyLastSyncedOn.getTime()) / (1000 * 3600 * 24)
        )
      : policySyncFreqDays + 1;
    if (daysSincePolicySync >= 1 && this.state.isConnected === true) {
      return true;
    } else {
      return false;
    }
  };

  shouldReportDevice = (deviceLogLastReportedOn) => {
    // We will sync device status per once day
    const deviceLogReportingFreqDays = 1;

    if (deviceLogLastReportedOn === null) {
      return true;
    }

    const today = new Date();
    const daysSinceLastLog = deviceLogLastReportedOn
      ? Math.round(
          (today.getTime() - deviceLogLastReportedOn.getTime()) /
            (1000 * 3600 * 24)
        )
      : deviceLogReportingFreqDays + 1;
    if (daysSinceLastLog >= 1) {
      return true;
    } else {
      return false;
    }
  };

  syncUpdatedPolicy = async () => {
    const policy = ipcRenderer.sendSync("api:getPolicy");
    if (policy === null || policy === undefined) {
      return;
    }
    // update policy synced time to now
    const ts = new Date();
    settings.set("policyLastSyncedOn", ts);
    this.setState({ policy: policy, policyLastSyncedOn: ts });
  };

  onDeviceConnected = ({ data }) => {
    // TODO: get user profile api (will do if required)
    // store token in safe storage
    const status = ipcRenderer.sendSync("auth:storeToken", data.accessToken);

    if (status === true) {
      settings.set("isConnected", true);
      settings.set("firstName", data.firstName);
      this.setState({
        isConnected: true,
        firstName: data.firstName,
      });
    }
  };

  onDeviceDisconnected = () => {
    // rmeove token stored from safestorage & state
    settings.set("isConnected", false);
    settings.set("firstName", null);
    ipcRenderer.sendSync("auth:logout");
    this.setState({
      isConnected: false,
      firstName: null,
    });
  };

  onDeviceLogRecorded = () => {
    const ts = new Date();
    settings.set("deviceLogLastReportedOn", ts);
    this.setState({
      deviceLogLastReportedOn: ts,
    });
  };

  onDownloadProgress = (event, downloadProgress) => {
    // trigger the app resize first time through
    if (!this.downloadStartSent) {
      ipcRenderer.send("download:start");
      this.downloadStartSent = true;
    }

    if (downloadProgress && downloadProgress.percent >= 99) {
      ipcRenderer.send("download:complete");
    } else {
      this.setState({ downloadProgress });
    }
  };

  onDownloadError = (event, error) => {
    ipcRenderer.send("download:complete", { resize: true });
    const msg = `Error downloading app update: ${error}`;
    log.error(msg);
    this.setState(
      {
        downloadProgress: null,
        error: msg,
      },
      () => {
        // reset this so downloading can start again
        this.downloadStartSent = false;
      }
    );
  };

  onScanError = ({ error }) => {
    this.errorThrown = true;
    log.error("Scan error", error);
    throw new Error(error);
  };

  onScanInit = ({ remote, remoteLabel }) => {
    ipcRenderer.send("scan:init");
    this.setState({
      loading: true,
      remoteScan: remote,
      scannedBy: remote ? remoteLabel : appName,
    });
  };

  remainingTimeInMinute = () => {
    return moment(new Date()).diff(moment(this.state.lastScanTime), "minutes");
  };

  onScanComplete = (payload) => {
    const { noResults = false } = payload;
    // device only scan with no policy completed
    if (noResults) {
      return this.setState({ loading: false, scannedBy: appName });
    }

    const {
      errors = [],
      remote: remoteScan,
      remoteLabel,
      result,
      policy: appPolicy,
      showNotification,
    } = payload;

    const lastScanTime = Date.now();

    if (errors && errors.length) {
      log.error(
        JSON.stringify({
          level: "error",
          message: "Error scanning",
          policy: appPolicy,
        })
      );

      return this.setState({
        loading: false,
        lastScanTime,
        errors: errors.map(({ message }) => message),
      });
    }

    const {
      data: { policy = {}, device = {} },
    } = Object(result);
    const scannedBy = remote ? remoteLabel : appName;

    const newState = {
      result: policy.validate,
      loading: false,
      lastScanTime,
      remoteScan,
      scannedBy,
    };

    this.setState(newState, () => {
      ipcRenderer.send("app:loaded");
      if (this.state.result.status !== "PASS" && showNotification) {
        const note = new Notification("Security recommendation", {
          body: "You can improve the security settings on this device. Click for more information.",
        });
        note.onerror = (err) => console.error(err);
      }
    });

    // TODO: check here if lastest policy synced or not
    if (
      this.shouldReportDevice(this.state.deviceLogLastReportedOn) &&
      this.state.isConnected
    ) {
      ipcRenderer.sendSync("api:reportDevice", policy.validate, device);
      // update deviceLogLastReportedOn
      this.onDeviceLogRecorded();
    }
  };

  handleErrorYAML = (
    err = { message: "Error requesting config information" }
  ) => {
    log.error("App:YAML error", err);
    this.setState({ error: err, loading: false });
  };

  handleErrorGraphQL = (err = { message: "Error in GraphQL request" }) => {
    log.error(`App:GraphQL error ${JSON.stringify(serializeError(err))}`);
    this.setState({ error: err, loading: false });
  };

  /**
   * loads config, policy, and instructions and initializes a scan
   * using them
   */
  loadPractices = () => {
    return new Promise((resolve, reject) =>
      this.setState({ loading: true }, () => {
        const basePath = ipcRenderer.sendSync("get:env:basePath");

        glob(`${basePath}/*.yaml`, (err, files) => {
          if (err || !files.length) {
            reject(err);
          }
          const configs = {};
          files.forEach((filePath) => {
            const parts = path.parse(filePath);
            const handle = readFileSync(filePath, "utf8");
            configs[parts.name.split(".").shift()] = yaml.load(handle);
          });

          this.setState({ ...configs, loading: false }, () => {
            if (!this.state.scanIsRunning) {
              this.handleScan();
            }
          });

          resolve();
        });
      })
    );
  };

  /**
   * Opens a link in the native default browser
   */
  handleOpenExternal = (event) => {
    event.preventDefault();
    if (event.target.getAttribute("href")) {
      shell.openExternal(event.target.getAttribute("href"));
    }
  };

  handleRestartFromLoader = (event) => {
    settings.set("recentHang", settings.get("recentHang", 0) + 1);
    ipcRenderer.send("app:restart");
  };

  /**
   * Performs a scan by passing the current policy to the graphql server
   */
  handleScan = () => {
    const { policy } = this.state;
    this.setState({ loading: true, scanIsRunning: true }, () => {
      Stethoscope.validate(policy)
        .then(({ device, result, timing }) => {
          const lastScanTime = Date.now();
          this.setState(
            {
              device,
              result,
              lastScanTime,
              lastScanDuration: timing.total / 1000,
              scanIsRunning: false,
              scannedBy: appName,
              loading: false,
            },
            () => {
              ipcRenderer.send("app:loaded");
            }
          );
          // to restart the scan
          if (this.remainingTimeInMinute() <= 10) {
            this.setState({
              countDown: 10 - this.remainingTimeInMinute(),
              actionButtonTitle: "Scan",
              enableReportNow: true,
            });
          }

          this.myInterval2 = setInterval(() => {
            if (this.remainingTimeInMinute() <= 10) {
              this.setState({
                countDown: 10 - this.remainingTimeInMinute(),
                actionButtonTitle: "Scan",
                enableReportNow: true,
              });
            }

            if (this.remainingTimeInMinute() > 10) {
              this.setState({
                countDown: 10,
                actionButtonTitle: "Re-Scan",
                enableReportNow: false,
              });
              clearInterval(this.myInterval2);
            }
          }, 60000);
        })
        .catch((err) => {
          console.log(err);
          log.error(JSON.stringify(err));
          let message = new Error(err.message);
          if (err.errors) message = new Error(JSON.stringify(err.errors));
          this.handleErrorGraphQL({ message });
        });
    });
  };

  handleHighlightRescanButton = (event) =>
    this.setState({ highlightRescan: true });

  onCancelReloadApp = () => {
    ipcRenderer.send("app:reload");
  };

  onShowActionDescription = (description) =>
    this.setState({
      showActionDescription: !this.state.showActionDescription,
      actionDescription: description,
    });

  render() {
    const {
      device,
      policy,
      result,
      downloadProgress,
      scannedBy,
      lastScanTime,
      lastScanDuration,
      error,
      deviceLogLastReportedOn,
      instructions,
      loading,
      highlightRescan,
      recentHang,
      remoteScan,
      recentLogs,
      actionButtonTitle,
      enableReportNow,
      countDown,
      isConnected,
      firstName,
    } = this.state;

    const isDev = ipcRenderer.sendSync("get:env:isDev");

    const reportingAppURI = isDev
      ? "http://localhost:5000/app/intranet/endpointScanLogs?drawerOpen=true"
      : appConfig.deviceStatusReportingAppURI;

    const reportingErrorLogAppURI = isDev
      ? "http://localhost:5000/app/intranet/endpointScanLogs?reportDrSprintoError=true"
      : appConfig.deviceDebugLogReportingAppURI;

    const deviceConnectAppURI = isDev
      ? "http://localhost:5000/app/intranet/endpointScanLogs?connectSprintoApp=true"
      : appConfig.deviceConnectAppURI;

    let content = null;

    // don't want to render entire app, partition device info, etc. if downloading an update
    if (downloadProgress !== null) {
      content = <DownloadProgress progress={downloadProgress} />;
    }

    const helpOptions = appConfig.menu.help.map(({ label, link }) => (
      <a key={link} className="helpLink" href={link}>
        {label}
      </a>
    ));

    if (error) {
      content = (
        <ErrorMessage
          version={pkg.version}
          showStack={isDev}
          message={error.message}
          stack={error.stack}
          reportingErrorLogAppURI={reportingErrorLogAppURI}
          onClickOpen={this.handleOpenExternal}
          onCancelReloadApp={this.onCancelReloadApp}
          onRescan={this.handleScan}
        >
          {helpOptions}
        </ErrorMessage>
      );
    }

    if (loading) {
      content = (
        <Loader
          onRestart={this.handleRestartFromLoader}
          recentHang={recentHang}
          remoteScan={remoteScan}
          remoteLabel={scannedBy}
          recentLogs={recentLogs}
          platform={platform}
          version={pkg.version}
          reportingErrorLogAppURI={reportingErrorLogAppURI}
          onClickOpen={this.handleOpenExternal}
          onCancelReloadApp={this.onCancelReloadApp}
          onRescan={this.handleScan}
        >
          {helpOptions}
        </Loader>
      );
    }

    if (isConnected === false) {
      content = (
        <>
          <ConnectToSprintoApp
            redirectURI={deviceConnectAppURI}
            onClickOpen={this.handleOpenExternal}
          />
        </>
      );
    }

    // if none of the overriding content has been added
    // assume no errors and loaded state
    if (!content) {
      const args = [policy, result, device, instructions.practices, platform];
      try {
        const secInfo = Stethoscope.partitionSecurityInfo(...args);
        const decoratedDevice = Object.assign({}, device, secInfo, {
          lastScanTime,
        });
        const lastScanFriendly = moment(lastScanTime).fromNow();

        content = (
          <div>
            <Device
              {...decoratedDevice}
              org={instructions.organization}
              scanResult={result}
              strings={instructions.strings}
              policy={policy}
              lastScanTime={lastScanFriendly}
              lastScanDuration={lastScanDuration}
              scannedBy={scannedBy}
              onExpandPolicyViolation={this.handleHighlightRescanButton}
              deviceLogLastReportedOn={deviceLogLastReportedOn}
              highlightRescan={highlightRescan}
              instructions={instructions}
              webScopeLink={appConfig.stethoscopeWebURI}
              reportingAppURI={reportingAppURI}
              reportingErrorLogAppURI={reportingErrorLogAppURI}
              onClickOpen={this.handleOpenExternal}
              onRescan={this.handleScan}
              onCancelReloadApp={this.onCancelReloadApp}
              onShowActionDescription={this.onShowActionDescription}
              actionButtonTitle={actionButtonTitle}
              enableReportNow={enableReportNow}
              countDown={countDown}
              firstName={firstName}
            />
          </div>
        );
      } catch (e) {
        throw new Error(
          `Unable to partition data: ${e.message}\n${args.join(", ")}`
        );
      }
    }

    return <div className={classNames("App", { loading })}>{content}</div>;
  }
}

export default App;
