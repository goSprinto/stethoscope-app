/* global Notification */
import React, { Component } from "react";
import unixify from "unixify";
import Stethoscope from "./lib/Stethoscope";
import Device from "./Device";
import Loader from "./Loader";
// import Footer from './Footer'
import DownloadProgress from "./DownloadProgress";
import openSocket from "socket.io-client";
import moment from "moment";
import classNames from "classnames";
import { HOST } from "./constants";
import appConfig from "./config.json";
import pkg from "../package.json";
import ErrorMessage from "./ErrorMessage";
import yaml from "js-yaml";
import "./App.css";
import ConnectToSprintoApp from "./components/ConnectToSprintoApp";
import OfflineSprintoApp from "./components/OfflineSprintoApp";
const socket = openSocket(HOST);
import isTrustedUrl from "./lib/utils";

// CRA doesn't like importing native node modules
// have to use window.require AFAICT
const os = window.require("os");
const glob = window.require("fast-glob");
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

    // auth related states
    isSprintoAppConnected: false,
    firstName: null,
    policyLastSyncedOn: null,
    offline: false,
    showDescription: false,
    // app base URL
    sprintoAPPBaseUrl: null,
  };

  componentWillUnmount = () => {
    this.setState({ scanIsRunning: false });
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

    // Setup base URL for first time. (This will be used for all API calls)
    // appConfig.apiBaseUrl - using for first time
    const isDev = ipcRenderer.sendSync("get:env:isDev");

    this.setState({
      recentHang: settings.get("recentHang", 0) > 1,
      deviceLogLastReportedOn,
      policyLastSyncedOn,
      isSprintoAppConnected: settings.get("isSprintoAppConnected", false),
      firstName: settings.get("firstName", null),
    });

    // Set baseUrl if not set in connect Flow
    const baseUrl = settings.get("sprintoAPPBaseUrl");
    if (baseUrl === null || baseUrl === undefined || baseUrl === "") {
      settings.set(
        "sprintoAPPBaseUrl",
        isDev ? "http://localhost:5000" : appConfig.apiBaseUrl
      );
    }
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
    // device offline status
    window.addEventListener("offline", () => this.setState({ offline: true }));
    window.addEventListener("online", () => this.setState({ offline: false }));
  }

  // update policy
  shouldPolicySync = (policyLastSyncedOn) => {
    // we will sync policy once per day

    const policySyncFreqDays = 1;

    if (
      policyLastSyncedOn === null &&
      this.state.isSprintoAppConnected === true
    ) {
      return true;
    }

    const today = new Date();
    const daysSincePolicySync = policyLastSyncedOn
      ? Math.round(
          (today.getTime() - policyLastSyncedOn.getTime()) / (1000 * 3600 * 24)
        )
      : policySyncFreqDays + 1;
    return (
      daysSincePolicySync >= 1 && this.state.isSprintoAppConnected === true
    );
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
    return daysSinceLastLog >= 1;
  };

  syncUpdatedPolicy = async () => {
    const baseUrl = await settings.get("sprintoAPPBaseUrl");
    const policy = ipcRenderer.sendSync("api:getPolicy", baseUrl);
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
    // load url from connecting Webapp

    if (status === true) {
      settings.set("sprintoAPPBaseUrl", data?.baseUrl);
      settings.set("isSprintoAppConnected", true);
      settings.set("firstName", data.firstName);
      this.setState({
        isSprintoAppConnected: true,
        firstName: data.firstName,
      });
    }
  };

  onDeviceDisconnected = () => {
    // rmeove token stored from safestorage & state
    settings.set("isSprintoAppConnected", false);
    settings.set("firstName", null);
    ipcRenderer.sendSync("auth:logout");
    this.setState({
      isSprintoAppConnected: false,
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

  isScanResultDiff = async (newResult) => {
    let result = false;
    const oldResult = settings.get("scanResult", {});

    for (const [key, value] of Object.entries(newResult)) {
      if (value !== oldResult[key]) {
        result = true;
      }
    }
    return result;
  };

  onScanComplete = async (payload) => {
    const { noResults = false } = payload;
    // device only scan with no policy completed
    if (noResults) {
      return this.setState({ loading: false, scannedBy: appName });
    }

    const oldScanResult = this.state.result;

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

    const isUpdatedScanResult = await this.isScanResultDiff(policy.validate);
    const baseUrl = await settings.get("sprintoAPPBaseUrl"); // Report the device now
    // report only if
    // 1. shouldReportDevice - is true & device connected
    // 2. Or. Last scan result is different than new one
    if (
      (this.shouldReportDevice(this.state.deviceLogLastReportedOn) ||
        isUpdatedScanResult) &&
      this.state.isSprintoAppConnected
    ) {
      const status = ipcRenderer.sendSync(
        "api:reportDevice",
        policy.validate,
        device,
        baseUrl
      );

      // store current result in local storage
      await settings.set("scanResult", policy.validate);

      // update deviceLogLastReportedOn if api call success
      if (status === true) {
        this.onDeviceLogRecorded();
      }
    }
  };

  handleErrorYAML = (
    err = { message: "Error requesting config information" }
  ) => {
    log.error("App:YAML error", err);
    this.setState({ error: err, loading: false });
  };

  handleErrorGraphQL = (err = { message: "Error in GraphQL request" }) => {
    log.error(`App:GraphQL error ${JSON.stringify(err)}`);
    this.setState({ error: err, loading: false });
  };

  /**
   * loads config, policy, and instructions and initializes a scan
   * using them
   */
  loadPractices = () => {
    return new Promise((resolve, reject) =>
      this.setState({ loading: true }, async () => {
        try {
          // Fetch the policy from the API directly
          const baseUrl = settings.get("sprintoAPPBaseUrl");
          const policy = ipcRenderer.sendSync("api:getPolicy", baseUrl);
          
          if (!policy) {
            this.setState({ error: "Failed to load policy. Please try again.", loading: false });
            reject("Failed to fetch policy from the API");
            return;
          }

          const basePath = ipcRenderer.sendSync("get:env:basePath");
          const currentBasePath = unixify(basePath);
          const files = await glob(`${currentBasePath}/*.yaml`);
          
          if (!files.length) {
            reject("No files found");
            return;
          }
  
          const configs = {};
          files.forEach((filePath) => {
            const parts = path.parse(filePath);
            const handle = readFileSync(filePath, "utf8");
            configs[parts.name.split(".").shift()] = yaml.load(handle);
          });
          this.setState({ ...configs, policy, loading: false }, () => {
            if (!this.state.scanIsRunning) {
              this.handleScan(); 
            }
          });
          resolve();
        } catch (error) {
          this.setState({ error: error.message || "Unexpected error occurred", loading: false });
          reject(error);
        }
      })
    );
  };

  /**
   * Opens a link in the native default browser
   */
  handleOpenExternalForRegister = async (event) => {
    let baseUrl = settings.get("sprintoAPPBaseUrl");
    const isDev = ipcRenderer.sendSync("get:env:isDev");
    if (isDev) {
      baseUrl = "http://localhost:5000";
    }

    const isUrlTrusted = isDev ? true : isTrustedUrl(baseUrl);

    event.preventDefault();
    if (event.target.getAttribute("href") && isUrlTrusted) {
      shell.openExternal(`${baseUrl}${event.target.getAttribute("href")}`);
    }
  };

  /**
   * Opens a link in the native default browser
   */
  handleOpenExternal = async (event) => {
    const url = await settings.get("sprintoAPPBaseUrl");
    const isDev = ipcRenderer.sendSync("get:env:isDev");
    const isUrlTrusted = isDev ? true : isTrustedUrl(url);
    event.preventDefault();
    if (event.target.getAttribute("href") && isUrlTrusted) {
      shell.openExternal(`${url}${event.target.getAttribute("href")}`);
    }
  };

  handleShowDescription = (event) => {
    event.preventDefault();
    this.setState({
      showDescription: !this.state.showDescription,
    });
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
      isSprintoAppConnected,
      firstName,
      offline,
    } = this.state;

    const isDev = ipcRenderer.sendSync("get:env:isDev");

    const reportingAppURI = appConfig.deviceStatusReportingAppURI;
    const reportingErrorLogAppURI = appConfig.deviceDebugLogReportingAppURI;
    const deviceConnectAppURI = appConfig.deviceConnectAppURI;

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

    if (isSprintoAppConnected === false) {
      content = (
        <>
          <ConnectToSprintoApp
            redirectURI={deviceConnectAppURI}
            onClickOpen={this.handleOpenExternalForRegister}
            onClickShowDescription={this.handleShowDescription}
            showDescription={this.state.showDescription}
            device={device}
          />
        </>
      );
    }

    if (offline === true) {
      content = (
        <>
          <OfflineSprintoApp />
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
              reportingAppURI={reportingAppURI}
              onClickOpen={this.handleOpenExternal}
              onRescan={this.handleScan}
              reportingErrorLogAppURI={reportingErrorLogAppURI}
              onCancelReloadApp={this.onCancelReloadApp}
              onShowActionDescription={this.onShowActionDescription}
              actionButtonTitle={actionButtonTitle}
              enableReportNow={enableReportNow}
              countDown={countDown}
              firstName={firstName}
              isSprintoAppConnected={isSprintoAppConnected}
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
