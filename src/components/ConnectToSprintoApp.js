import Button from "./Button";
import React from "react";

const WelcomeMessage = () => {
  return (
    <div>
      <div className="text-sm">Welcome,</div>
      <p className="text-sm">
        Please connect your device with Sprinto to start reporting device
        health.
      </p>
    </div>
  );
};

const ConnectToSprintoApp = ({ onClickOpen, redirectURI }) => {
  return (
    <>
      <div className="device-wrapper">
        <div className="panel device pass">
          <WelcomeMessage />
        </div>
      </div>

      <div className="center">
        <Button
          title={"Connect to Sprinto"}
          isPrimary={true}
          onClickOpen={onClickOpen}
          redirectURI={redirectURI}
          className="bg-orangeOne text-white"
        />
      </div>
    </>
  );
};

export default ConnectToSprintoApp;
