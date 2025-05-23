import perspective, { TableData } from "@finos/perspective";
import "@finos/perspective-viewer";
import "@finos/perspective-viewer-datagrid";
import "@finos/perspective-viewer-d3fc";
import {
  HTMLPerspectiveViewerElement,
  PerspectiveViewerConfig,
} from "@finos/perspective-viewer";
import "./themes.css";
import "@finos/perspective-viewer/dist/css/pro.css";
import "@finos/perspective-viewer/dist/css/pro-dark.css";
import "@finos/perspective-viewer/dist/css/vaporwave.css";
import "@finos/perspective-viewer/dist/css/solarized.css";
import "@finos/perspective-viewer/dist/css/solarized-dark.css";
import "@finos/perspective-viewer/dist/css/monokai.css";
import "./PerspectivePlugins";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { panelLogger } from "@modules/logger";
import useAppContext from "@modules/app/useAppContext";
import classes from "./perspective.module.scss";
import perspectiveStyles from "./perspective.scss?inline";
import { executeRequestInAsync } from "@modules/app/requestExecutor";
import useQueryPanelState from "@modules/queryPanel/useQueryPanelState";
import { useQueryPanelDispatch } from "@modules/queryPanel/QueryPanelProvider";
import { setPerspectiveTheme } from "@modules/queryPanel/context/queryPanelSlice";
import { Drawer, DrawerRef } from "@uicore";
import { useErrorBoundary } from "react-error-boundary";

interface Props {
  data: TableData;
  columnNames: string[];
  columnTypes: string[];
  styles?: CSSProperties;
}
const PerspectiveViewer = ({
  columnNames,
  columnTypes,
  data,
  styles,
}: Props): JSX.Element => {
  const {
    state: { theme },
  } = useAppContext();

  const { showBoundary } = useErrorBoundary();

  const { perspectiveTheme } = useQueryPanelState();
  const dispatch = useQueryPanelDispatch();
  const [tableRendered, setTableRendered] = useState(false);
  const [drawerData, setDrawerData] = useState<string>("");
  const [drawerTitle, setDrawerTitle] = useState<string>("");
  const perspectiveViewerRef = useRef<HTMLPerspectiveViewerElement>(null);
  const drawerRef = useRef<DrawerRef | null>(null);

  const config: PerspectiveViewerConfig = {
    theme: perspectiveTheme,
    title: "query result",
    columns: [], // reset columns
    settings: false,
    plugin_config: { editable: false },
  };

  const mapType = (agateType: string) => {
    switch (agateType) {
      case "Text":
        return "string";
      case "Integer":
        return "float";
      case "Number":
        return "float";
      default:
        // treat any unknown types as string
        return "string";
    }
  };

  // Converts the provided data to CSV format.
  const dataToCsv = (columns: string[], rows: TableData) => {
    if (!Array.isArray(rows)) {
      return;
    }

    if (!rows || rows.length === 0) {
      panelLogger.error("No data available to convert to CSV");
      return "";
    }
    const replacer = (_key: string, value: unknown) =>
      value === null ? "" : value;
    const csv = [
      columns.join(","),
      ...rows.map((row) =>
        columns
          .map((fieldName) => {
            const fieldData = row[fieldName];
            if (fieldData && typeof fieldData === "string") {
              return `"${(fieldData as string).replace(/"/g, '""')}"`; // escape double quotes and Wrap in double quotes
            }
            return JSON.stringify(fieldData, replacer);
          })
          .join(","),
      ),
    ].join("\r\n");
    return csv;
  };

  const downloadAsCSV = () => {
    try {
      if (!data || !Array.isArray(data) || data.length === 0) {
        panelLogger.error("No data available for downloading.");
        return;
      }
      const csvContent = dataToCsv(columnNames, data);
      if (!csvContent) {
        panelLogger.info("empty csv content", columnNames, data);
        return;
      }
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `power_user_data_${new Date().toISOString()}.csv`; // Filename with a timestamp
      a.click();
    } catch (error) {
      // Log error for debugging
      panelLogger.error("Failed to download CSV:", error);
      executeRequestInAsync("error", {
        text: "Unable to download data as CSV. " + (error as Error).message,
      });
    }
  };

  const updateCustomStyles = (currentTheme: string) => {
    const shadowRoot = perspectiveViewerRef.current?.querySelector(
      "perspective-datagrid-json-viewer-plugin",
    )?.shadowRoot;
    if (!shadowRoot) {
      return;
    }
    const id = "altimate-styles";
    shadowRoot.getElementById(id)?.remove();

    const style = document.createElement("style");
    style.textContent = perspectiveStyles;
    style.id = id;
    shadowRoot.appendChild(style);
    shadowRoot.querySelector("regular-table")?.setAttribute("theme", theme);
    shadowRoot
      .querySelector("regular-table")
      ?.setAttribute("perspective-theme", currentTheme);
  };

  const loadPerspectiveData = async () => {
    if (!perspectiveViewerRef.current) {
      return;
    }

    const dataFormats = {
      types: {
        integer: {
          format: {
            useGrouping: false,
          },
        },
        float: {
          format: {
            maximumFractionDigits: 20,
            minimumFractionDigits: 0,
            useGrouping: false,
          },
        },
      },
    };

    const schema: Record<string, string> = {};
    for (let i = 0; i < columnNames.length; i++) {
      schema[columnNames[i]] = mapType(columnTypes[i]);
    }

    try {
      // @ts-expect-error valid parameter
      const worker = perspective.worker(dataFormats);
      const table = await worker.table(schema);
      await table.replace(data);

      await perspectiveViewerRef.current.load(table);
      await perspectiveViewerRef.current.resetThemes([
        "Vintage",
        "Pro Light",
        "Pro Dark",
        "Vaporwave",
        "Solarized",
        "Solarized Dark",
        "Monokai",
      ]);
      await perspectiveViewerRef.current.restore(config);
      const datagridShadowRoot = perspectiveViewerRef.current?.shadowRoot;
      if (datagridShadowRoot) {
        const exportButton = datagridShadowRoot.getElementById("export");
        if (!exportButton) {
          return;
        }
        exportButton.removeEventListener("click", downloadAsCSV);
        exportButton.addEventListener("click", downloadAsCSV);
      }
      updateCustomStyles(perspectiveTheme);
      perspectiveViewerRef.current.addEventListener(
        "perspective-config-update",
        (event) => {
          const ev = event as CustomEvent<PerspectiveViewerConfig>;
          panelLogger.log("perspective-config-update", ev.detail);
          if (ev.detail.theme) {
            updateCustomStyles(ev.detail.theme);
            executeRequestInAsync("updateConfig", {
              perspectiveTheme: ev.detail.theme,
            });
            dispatch(setPerspectiveTheme(ev.detail.theme));
          }
        },
      );
    } catch (err) {
      panelLogger.error("error while loading perspective data", err);
      // catching this error: Uncaught (in promise) RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory for new instance
      const isWasmError = (err as Error)?.message?.includes(
        "WebAssembly.instantiate",
      );
      if (isWasmError) {
        showBoundary(err);
      }
    }
    setTableRendered(true);
  };

  useEffect(() => {
    loadPerspectiveData().catch((err) => panelLogger.error(err));

    // Handle the event when a string or JSON is clicked in the perspective viewer datagrid
    const handleOpenDrawer = (event: CustomEvent) => {
      drawerRef.current?.open();
      const detail = event.detail as {
        type: string;
        message: string;
        columnName: string;
      };
      setDrawerTitle(detail?.columnName);
      if (detail?.type === "string") {
        // adding \n after every 45 characters to make it readable
        setDrawerData(
          detail?.message.match(/.{1,45}/g)?.join("\n") ?? detail?.message,
        );
      } else if (detail?.type === "json") {
        // Pretty print JSON
        setDrawerData(JSON.stringify(JSON.parse(detail?.message), null, 2));
      }
    };

    // Add an event listener to open the drawer when a string or JSON is clicked
    window.addEventListener(
      "string-json-viewer",
      handleOpenDrawer as EventListener,
    );

    return () => {
      perspectiveViewerRef.current
        ?.getTable()
        .then((table) => table.delete())
        .catch((err) =>
          panelLogger.error("error while deleting perspective table", err),
        );
      perspectiveViewerRef.current
        ?.delete()
        .catch((err) =>
          panelLogger.error("error while deleting perspective viewer", err),
        );

      // Remove the event listener when the component is unmounted
      window.removeEventListener(
        "string-json-viewer",
        handleOpenDrawer as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!tableRendered || !config.theme || !perspectiveViewerRef.current) {
      return;
    }

    perspectiveViewerRef.current
      ?.querySelector("perspective-viewer-datagrid")
      ?.shadowRoot?.querySelector("regular-table")
      ?.setAttribute("theme", theme);
    perspectiveViewerRef.current
      .restore(config)
      .catch((err) =>
        panelLogger.error("error while restoring perspective", err),
      );
  }, [theme, tableRendered]);

  return (
    <>
      <perspective-viewer
        class={classes.altimatePerspectiveViewer}
        ref={perspectiveViewerRef}
        style={styles}
      ></perspective-viewer>
      <Drawer
        buttonProps={{ color: "primary", title: "Json Viewer" }}
        ref={drawerRef}
        title={drawerTitle}
        backdrop={false}
      >
        <pre>{drawerData}</pre>
      </Drawer>
    </>
  );
};
export default PerspectiveViewer;
