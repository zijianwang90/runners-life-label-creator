import { contextBridge, ipcRenderer } from "electron";
import type { AppData, ElectronAPI, PrintPayload, UpdateState } from "../src/types";

const api: ElectronAPI = {
  loadData: () => ipcRenderer.invoke("data:load"),
  saveData: (data: AppData) => ipcRenderer.invoke("data:save", data),
  print: (payload: PrintPayload) => ipcRenderer.invoke("print:run", payload),
  onPrintPayload: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, message: { jobId: string; payload: PrintPayload }) => {
      callback(message.jobId, message.payload);
    };
    ipcRenderer.on("print:payload", listener);
    return () => ipcRenderer.removeListener("print:payload", listener);
  },
  notifyPrintReady: (jobId: string) => ipcRenderer.send("print:ready", jobId),
  getAppVersion: () => ipcRenderer.invoke("app:version"),
  getUpdateState: () => ipcRenderer.invoke("update:state"),
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  openReleasePage: () => ipcRenderer.invoke("update:open-release"),
  onUpdateState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) => callback(state);
    ipcRenderer.on("update:state", listener);
    return () => ipcRenderer.removeListener("update:state", listener);
  }
};

contextBridge.exposeInMainWorld("electronAPI", api);
