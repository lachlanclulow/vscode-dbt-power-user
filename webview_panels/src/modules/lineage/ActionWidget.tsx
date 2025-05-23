import MissingLineageMessageComponent from "./MissingLineageMessage";
import { MissingLineageMessage } from "./types";
import FeedbackButton from "@modules/commonActionButtons/FeedbackButton";
import HelpButton from "./components/help/HelpButton";
import { Button } from "@uicore";
import { executeRequestInAsync } from "@modules/app/requestExecutor";
import { CLL } from "@lib";
import styles from "./lineage.module.scss";

const ActionWidget = ({
  missingLineageMessage,
  aiEnabled,
  lineageType,
}: {
  missingLineageMessage?: MissingLineageMessage;
  aiEnabled: boolean;
  lineageType: "sql" | "dynamic";
}): JSX.Element => {
  if (lineageType === "sql") {
    return (
      <div className={styles.actionWidget}>
        <FeedbackButton url="https://app.myaltimate.com/contactus" />
      </div>
    );
  }
  return (
    <div className={styles.actionWidget}>
      <MissingLineageMessageComponent
        missingLineageMessage={missingLineageMessage}
      />

      <div id="expand-container" />
      <div id="export-container" />
      <div id="settings-container" />
      <Button
        outline
        onClick={() => {
          executeRequestInAsync("setLegacyLineageView", {});
          CLL.cancel();
        }}
      >
        Show Legacy UX
      </Button>
      <HelpButton />
      <div id="reset-container" />
      <FeedbackButton
        url={
          aiEnabled
            ? "https://form.jotform.com/251106238702145"
            : "https://form.jotform.com/251076719766165"
        }
      />
    </div>
  );
};

export default ActionWidget;
