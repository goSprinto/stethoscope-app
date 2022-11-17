import Button from "./Button";
import React from "react";

const WelcomeMessage = () => {
  return (
    <div>
      <div className="text-sm">Welcome,</div>
      <p className="text-sm">
        To ensure your device complies with the company's endpoint security
        policy, you need to scan the device and send the health report to
        Sprinto.
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
