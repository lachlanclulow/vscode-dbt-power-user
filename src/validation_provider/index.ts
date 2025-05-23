import { Disposable, commands, window, workspace } from "vscode";
import { provideSingleton } from "../utils";
import {
  AltimateRequest,
  ForbiddenError,
  NoCredentialsError,
} from "../altimate";

const validTenantRegex = new RegExp(/^[a-z_][a-z0-9_]*$/);

@provideSingleton(ValidationProvider)
export class ValidationProvider implements Disposable {
  private disposables: Disposable[] = [];
  private _isAuthenticated = false;

  constructor(private altimate: AltimateRequest) {
    this.disposables.push(
      workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration("dbt")) {
          return;
        }
        this.validateCredentials();
        this.setDBTContext();
      }),
    );
    this.setDBTContext();
  }

  setDBTContext() {
    let dbtIntegration = workspace
      .getConfiguration("dbt")
      .get<string>("dbtIntegration", "core");

    if (!["core", "cloud"].includes(dbtIntegration)) {
      dbtIntegration = "core";
    }
    commands.executeCommand(
      "setContext",
      "dbtPowerUser.dbtIntegration",
      dbtIntegration,
    );
  }

  validateCredentials() {
    this._validateCredentials(false);
  }

  validateCredentialsSilently() {
    this._validateCredentials(true);
  }

  private async _validateCredentials(silent: boolean) {
    const key = this.altimate.getAIKey();
    const instance = this.altimate.getInstanceName();

    // only validate when both are set
    if (!key || !instance) {
      this._isAuthenticated = false;
      return;
    }

    let message = "";
    if (!validTenantRegex.exec(instance)) {
      message = "Instance name must not be URL.";
    } else if (key.length !== 32) {
      message = "API key is not valid";
    }
    if (message) {
      this._isAuthenticated = false;
      if (!silent) {
        window.showErrorMessage(message);
      }
      return;
    }
    const connectivity = await this.altimate.checkApiConnectivity();
    if (connectivity?.status !== "ok") {
      this._isAuthenticated = false;
      if (!silent) {
        window.showErrorMessage(
          "Unable to connect to Altimate Service. Please check your Firewall/VPN settings or check service [status](https://altimateai.instatus.com/).",
        );
      }
      return;
    }
    const validation = await this.altimate.validateCredentials(instance, key);
    if (!validation?.ok) {
      this._isAuthenticated = false;
      if (!silent) {
        window.showErrorMessage(
          `Credentials are invalid. ${validation?.detail}`,
        );
      }
      return;
    }
    this._isAuthenticated = true;
  }

  isAuthenticated() {
    return true;
  }

  throwIfNotAuthenticated() {
    if (!this.isAuthenticated()) {
      const message = this.altimate.getCredentialsMessage();
      throw message ? new NoCredentialsError(message) : new ForbiddenError();
    }
  }

  dispose() {
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
