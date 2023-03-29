import Button from "./Button";
import React from "react";
import LaptopIcon from "../icons/LaptopIcon";
import SignalLoading from "../icons/SignalLoading";
import SprintoIcon from "../icons/SprintoIcon";

const WelcomeMessage = ({ onClickShowDescription, showDescription }) => {
  return (
    <div>
      <div>
        <h1 className="text-sm mb-0">Share device info with Sprinto</h1>
        <div className="text-sm">
          Let Sprinto know about the device you are using.
        </div>
      </div>
      <p className="mt-6">
        <a
          className={`text-xs cursor-pointer ${
            showDescription ? "open" : "closed"
          }`}
          href="/#"
          onClick={onClickShowDescription}
        >
          What will be shared with Sprinto?
        </a>
      </p>

      {showDescription ? (
        <div className="action-description">
          <div className="text-xs">
            The following details will be monitored and shared with Sprinto:
          </div>
          <ol className="text-xs">
            <li>OS version: The current version of the operating system. </li>
            <li>Antivirus status: Status of antivirus being enabled.</li>
            <li>
              Screen-lock status: Status of screen-lock and auto-lock being
              enabled.
            </li>
            <li>Disk encryption: Status of disk encryption being enabled.</li>
          </ol>
        </div>
      ) : null}
    </div>
  );
};

const ConnectToSprintoApp = ({
  onClickOpen,
  redirectURI,
  showDescription,
  onClickShowDescription,
  device,
}) => {
  return (
    <div className="panel device pass">
      <div>
        <div>
          <WelcomeMessage
            onClickShowDescription={onClickShowDescription}
            showDescription={showDescription}
          />
        </div>
      </div>

      <div className="grid-container grid grid-cols-12 items-center mt-9">
        <div
          className="col-span-6 border-solid rounded-md justify-between p-2 mr-2  h-full"
          style={{ borderColor: "#e5e7eb" }}
        >
          <div>
            <div>
              <LaptopIcon />
            </div>
            <div className="ml-1">
              <div className="text-xs font-sm font-medium">
                {device.friendlyName}
              </div>
              <div className="text-xs">{device.deviceId}</div>
            </div>
          </div>
        </div>
        <div className="col-span-2 flex justify-center">
          <SignalLoading />
        </div>
        <div
          className="col-span-4 border-solid rounded-md p-2 h-full"
          style={{ borderColor: "#e5e7eb" }}
        >
          <div>
            <div className="flex justify-center pt-2">
              <SprintoIcon height={64} width={64} />
            </div>

            <div className="flex justify-center">
              <div className="text-xs font-sm font-medium">Sprinto account</div>
            </div>
          </div>
        </div>
      </div>

      <div className=" fixed bottom-5 right-0 ">
        <div className="text-xs flex justify-end mr-3">
          * This will open the Sprinto application in your web browser
        </div>
        <div className="flex justify-end">
          <Button
            title={"Share device info"}
            isPrimary={true}
            onClickOpen={onClickOpen}
            redirectURI={redirectURI}
            className="bg-orangeOne text-white"
          />
        </div>
      </div>
    </div>
  );
};

export default ConnectToSprintoApp;
