import React, { Component } from "react";
import Action from "./Action";
import ActionIcon, { VARIANTS } from "./ActionIcon";
import semver from "./lib/patchedSemver";
import _ from "lodash";
import {
  INVALID_INSTALL_STATE,
  INVALID_VERSION,
  SUGGESTED_INSTALL,
  SUGGESTED_UPGRADE,
  PASS,
} from "./constants";
import "./Device.css";
import WindowsOSIcon from "./icons/WindowsOSIcon";
import MacOSIcon from "./icons/MacOsIcon";
import LinuxIcon from "./icons/LinuxIcon";
import ManjaroLinuxOSIcon from "./icons/ManjaroLinuxOSIcon";
import PopOSIcon from "./icons/PopOsIcon";
import UbuntuOSIcon from "./icons/UbuntuOsIcon";
import LinuxMintOSIcon from "./icons/LinuxMintOsIcon";
import FedoraLinuxOSIcon from "./icons/FedoraLinuxOSIcon";
import Button from "./components/Button";
import ButtonLink from "./components/ButtonLink";
import LaptopIcon from "./icons/LaptopIcon";

const WelcomeMessage = ({ name, showWelcomeDescription, showDescription }) => {
  return (
    <div className="pb-3">
      <div className="text-sm">Welcome {name},</div>
      <p className="text-sm">
        Keep Dr Sprinto running in the background to report your laptop security
        status automatically.
      </p>
      <p>
        <a
          className={`text-xs cursor-pointer text-underline ${
            showDescription ? "open" : "closed"
          }`}
          type="button"
          onClick={showWelcomeDescription}
        >
          What is being shared with Sprinto?
        </a>
      </p>

      {showDescription ? (
        <div className="text-xs action-description">
          <div className="text-xs">
            The following details will be monitored and shared with Sprinto:
          </div>
          <ol className="text-xs text-gray">
            <li>OS (Current version) </li>
            <li>Antivirus (Enabled or Disabled).</li>
            <li>Screen-lock (Enabled or Disabled)</li>
            <li>Disk encryption (Enabled or Disabled)</li>
          </ol>
        </div>
      ) : null}
    </div>
  );
};

const mapOsToRegex = {
  windows: /windows/i,
  macOS: /mac/i,
  popOS: /pop/i,
  linuxMint: /mint/i,
  manjaroLinux: /manjaro/i,
  fedoraLinux: /fedora/i,
  ubuntu: /ubuntu/i,
  oracleLinux: /oracle/i,
};

const mapOsToIcon = {
  windows: <WindowsOSIcon height={51} width={51} />,
  macOS: <MacOSIcon height={51} width={51} />,
  popOS: <PopOSIcon height={51} width={51} />,
  linuxMint: <LinuxMintOSIcon height={51} width={51} />,
  manjaroLinux: <ManjaroLinuxOSIcon height={51} width={51} />,
  fedoraLinux: <FedoraLinuxOSIcon height={51} width={51} />,
  ubuntu: <UbuntuOSIcon height={51} width={51} />,
  oracleLinux: <LinuxIcon height={51} width={51} />,
};

const DeviceDetails = ({
  daysSinceLastLog,
  deviceLogReportingFreqDays,
  onClickOpen,
  friendlyName,
  identifier,
  label,
  lastScan,
  lastScanTime,
  platformName,
}) => {
  const _getOSIconName = (osName) => {
    for (const [_os, _regex] of _.entries(mapOsToRegex)) {
      if (_regex.test(osName)) {
        return _.get(mapOsToIcon, _os);
      }
    }
  };

  const IconNameForRespectiveOS = _getOSIconName(platformName);

  return (
    <>
      <div
        className="flex items-center border-solid rounded-md justify-between mt-5 p-3"
        style={{ borderColor: "#e5e7eb" }}
      >
        <div className="flex items-center">
          <div>{IconNameForRespectiveOS || <LaptopIcon />}</div>
          <div className="ml-3">
            <div className="text-lg font-sm font-medium">{friendlyName}</div>
            <div className="text-sm">{identifier}</div>
            <div className="text-xs text-slate-400">
              {lastScan} {lastScanTime}
            </div>
          </div>
        </div>
        <div>
          <Button
            title={label}
            isPrimary={daysSinceLastLog > deviceLogReportingFreqDays}
            onClickOpen={onClickOpen}
            icon={true}
          />
        </div>
      </div>
    </>
  );
};

const ShowAutoReportingStatus = ({
  daysSinceLastLog,
  onClickOpen,
  reportingErrorLogAppURI,
  reportingAppURI,
}) => {
  return (
    <>
      {daysSinceLastLog === 0 ? (
        <>
          <div
            className="bg-green-200 text-sm border rounded relative p-3"
            role="alert"
          >
            <div>
              <span className="text-sm font-small">Last reported today.</span>
              <div className="text-xs text-slate-400">
                Next report will be automatically submitted tomorrow.
              </div>
            </div>
          </div>
          <div className="flex justify-end text-xs text-slate-600">
            <ButtonLink
              isPrimary={true}
              title={"Try an alternative way of reporting"}
              onClickOpen={onClickOpen}
              redirectURI={reportingAppURI}
            />
          </div>
        </>
      ) : (
        <>
          <div
            className="flex flex-row items-center bg-yellow-200 text-sm border rounded relative p-3 justify-between"
            role="alert"
          >
            <div className="flex items-center">
              <div>
                <ActionIcon
                  className="action-icon"
                  height="20"
                  width="20"
                  variant={"SUGGEST"}
                />
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium">Device not reporting</div>
                <div className=" text-sm font-small">
                  Last reported {daysSinceLastLog}
                  {daysSinceLastLog === 1 ? " day" : " days"} ago
                </div>
                <div className="text-xs text-slate-600">
                  <ButtonLink
                    onClickOpen={onClickOpen}
                    redirectURI={reportingErrorLogAppURI}
                    title={"let us know about this issue"}
                  />
                </div>
              </div>
            </div>
            <div>
              <Button
                isPrimary={true}
                title={"Report manually"}
                onClickOpen={onClickOpen}
                redirectURI={reportingAppURI}
                disabled={false}
                className="m-0 bg-orangeOne rounded space-x-2 justify-center content-box inline-flex items-center text-white"
              />
            </div>
          </div>
        </>
      )}
    </>
  );
};

class Device extends Component {
  constructor(props) {
    super(props);

    this.state = {
      showInfo: false,
      showDescription: false,
    };
  }

  renderAppVersionSuggestion = (installed, suggested) => {
    return (
      <table style={{ width: "auto", marginTop: "10px" }}>
        <tbody>
          <tr>
            <td>Suggested version:</td>
            <td>
              <span className="suggested-value">{String(suggested)}</span>
            </td>
          </tr>
          <tr>
            <td>Your version:</td>
            <td>
              <span className="suggested-value">{String(installed)}</span>
            </td>
          </tr>
        </tbody>
      </table>
    );
  };

  renderApplicationStateMessage = ({
    state,
    version,
    installed,
    policy = {},
  }) => {
    const installPrompt = policy.installFrom ? (
      <p>
        Install from{" "}
        <a href={policy.installFrom} target="_blank" rel="noopener noreferrer">
          here
        </a>
      </p>
    ) : null;
    if (state === INVALID_INSTALL_STATE && !installed) {
      return <p>You must have this application installed.{installPrompt}</p>;
    } else if (state === INVALID_INSTALL_STATE && installed) {
      return <p>You must not have this application installed</p>;
    } else if (state === INVALID_VERSION || state === SUGGESTED_UPGRADE) {
      return (
        <>
          {this.renderAppVersionSuggestion(
            version,
            semver.coerce(policy.version)
          )}
          {installPrompt && <p>{installPrompt}</p>}
        </>
      );
    } else if (state === SUGGESTED_INSTALL) {
      return <p>It is suggested that this applicaiton is installed</p>;
    }
    return null;
  };

  actions(actions, type, device) {
    const status = type === "done" ? "PASS" : "FAIL";
  
    return actions.map((action, index) => {
      const actionProps = {
        action,
        device,
        status,
        type,
        key: action.title[status],
        onExpandPolicyViolation: this.props.onExpandPolicyViolation,
        platform: this.props.platform,
        policy: this.props.policy,
        security: this.props.security,
        expandedByDefault: type === "critical" && index === 0,
        onShowActionDescription: this.props.onShowActionDescription,
        onCancelReloadApp: this.props.onCancelReloadApp,
        onRescan: this.props.onRescan,
        reportingErrorLogAppURI: this.props.reportingErrorLogAppURI,
        onClickOpen: this.props.onClickOpen,
        scanResult: this.props.scanResult,
      };

      const hasResults = Array.isArray(action.results);
      let results = action.results;

      if (hasResults && action.name.endsWith("applications")) {
        results = results.map((result, index) => {
          if (
            action.name in this.props.policy &&
            Array.isArray(this.props.policy[action.name])
          ) {
            const target = this.props.policy[action.name][index];
            if (target) {
              result.policy = target;
            }
          }
          return result;
        });
      }

      if (hasResults) {
        return (
          <Action {...actionProps} key={`action-container-${action.name}`}>
            <ul className="result-list" key={`action-ul-${action.name}`}>
              {results.map((data, index) => {
                const { name, status, state, policy = {} } = data;
                const { description } = policy;
                let iconVariant =
                  status === PASS ? VARIANTS.PASS : VARIANTS.BLOCK;

                if (
                  state === SUGGESTED_INSTALL ||
                  state === SUGGESTED_UPGRADE
                ) {
                  iconVariant = VARIANTS.SUGGEST;
                }

                return (
                  <li className="result-list-item" key={`action-li-${name}`}>
                    <div className="result-heading">
                      <strong>
                        <ActionIcon
                          className="action-icon"
                          size="15px"
                          variant={iconVariant}
                        />{" "}
                        {name}
                      </strong>{" "}
                    </div>
                    {description ? <p>{description}</p> : null}
                    {this.renderApplicationStateMessage(data)}
                    {index !== results.length - 1 ? <hr /> : null}
                  </li>
                );
              })}
            </ul>
          </Action>
        );
      } else {
        return (
          <Action {...actionProps} key={`action-container-${action.name}`} />
        );
      }
    });
  }

  process(device) {
    const d = Object.assign({}, device);
    d.friendlyName = d.friendlyName || "Unknown device";
    d.identifier =
      d.deviceName || d.hardwareSerial || (d.macAddresses || []).join(" ");

    return d;
  }

  handleToggleInfo = () => {
    this.setState({
      showInfo: !this.state.showInfo,
    });
  };

  showWelcomeDescription = (event) => {
    event.preventDefault();
    this.setState({
      showDescription: !this.state.showDescription,
    });
  };

  render() {
    const {
      deviceLogLastReportedOn,
      scanResult,
      onClickOpen,
      onRescan,
      reportingAppURI,
      actionButtonTitle,
      firstName,
      reportingErrorLogAppURI,
    } = this.props;

    const deviceLogReportingFreqDays = 90;
    const today = new Date();
    const daysSinceLastLog = deviceLogLastReportedOn
      ? Math.round(
          (today.getTime() - deviceLogLastReportedOn.getTime()) /
            (1000 * 3600 * 24)
        )
      : deviceLogReportingFreqDays + 1;

    if (!this.props.stethoscopeVersion) return null;

    const device = Object.assign({}, this.props, this.process(this.props));

    let deviceClass = "ok";

    if (scanResult.status !== "PASS") {
      deviceClass = scanResult.status === "NUDGE" ? "warning" : "critical";
    }
    
    let actions = [];

    if(this.props.policy && Object.keys(this.props.policy).length > 0) {
      actions = [
        ...this.actions(device.error, "error", device),
        ...this.actions(device.unknown, "unknown", device),
        ...this.actions(device.critical, "critical", device),
        ...this.actions(device.suggested, "suggested", device),
        ...this.actions(device.done, "done", device),
      ];
    }

    return (
      <div className="device-wrapper">
        <div className={`panel device ${deviceClass}`}>
          <WelcomeMessage
            name={firstName}
            showWelcomeDescription={this.showWelcomeDescription}
            showDescription={this.state.showDescription}
          />
          <ShowAutoReportingStatus
            daysSinceLastLog={daysSinceLastLog}
            deviceLogReportingFreqDays={deviceLogReportingFreqDays}
            onClickOpen={onClickOpen}
            reportingErrorLogAppURI={reportingErrorLogAppURI}
            reportingAppURI={reportingAppURI}
          />
          <DeviceDetails
            friendlyName={device.friendlyName}
            identifier={device.identifier}
            deviceLogReportingFreqDays={deviceLogReportingFreqDays}
            daysSinceLastLog={daysSinceLastLog}
            reportingAppURI={reportingAppURI}
            onClickOpen={onRescan}
            label={actionButtonTitle}
            lastScan={this.props.lastScan}
            scannedBy={this.props.scannedBy}
            lastScanTime={this.props.lastScanTime}
            lastScanDuration={this.props.lastScanDuration}
            platformName={device.platformName}
          />
          {actions.length > 0 && (
            <div className="grid gap-2 grid-cols-2 grid-rows-3 mt-8">
              {actions}
            </div>
          )}
        </div>
      </div>
    );
  }
}

Device.defaultProps = {
  macAddresses: [],
  ipAddresses: [],
  critical: [],
  suggested: [],
  messages: {},
  done: [],
};

export default Device;
