import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UpdateChannel, UpdateInfo, UpdateState, UpdateStatus } from "../types";
import { UpdateDialog } from "./UpdateDialog";

const update: UpdateInfo = {
  version: "1.2.0",
  notes: "Faster printing",
  pageUrl: "https://github.com/zijianwang90/runners-life-label-creator/releases/tag/v1.2.0",
  publishedAt: "2026-10-30T12:00:00Z",
  sizeBytes: 97_000_000
};

function renderDialog(status: UpdateStatus, channel: UpdateChannel = "portable") {
  const state: UpdateState = { channel, currentVersion: "1.1.0", status };
  const handlers = { onClose: vi.fn(), onCheck: vi.fn(), onInstall: vi.fn(), onOpenReleasePage: vi.fn() };
  render(<UpdateDialog open state={state} {...handlers} />);
  return handlers;
}

describe("UpdateDialog", () => {
  afterEach(cleanup);

  it("offers to update and shows the release notes", () => {
    const handlers = renderDialog({ state: "available", update });
    expect(screen.getByRole("heading", { name: "Version 1.2.0" })).toBeInTheDocument();
    expect(screen.getByText("Faster printing")).toBeInTheDocument();
    expect(screen.getByText(/92\.5 MB/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Update and restart/ }));
    expect(handlers.onInstall).toHaveBeenCalledTimes(1);
  });

  it("only points a copy that cannot update itself to the release page", () => {
    const handlers = renderDialog({ state: "available", update }, "manual");
    expect(screen.queryByRole("button", { name: /Update and restart/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Open release page/ }));
    expect(handlers.onOpenReleasePage).toHaveBeenCalledTimes(1);
    expect(handlers.onInstall).not.toHaveBeenCalled();
  });

  it("shows download progress", () => {
    renderDialog({ state: "downloading", update, receivedBytes: 48_500_000, totalBytes: 97_000_000 });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("cannot be closed while the update is being installed", () => {
    renderDialog({ state: "installing", update });
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });

  it("retries an interrupted update without checking again", () => {
    const handlers = renderDialog({ state: "error", message: "The download stalled.", update });
    expect(screen.getByText("The download stalled.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(handlers.onInstall).toHaveBeenCalledTimes(1);
    expect(handlers.onCheck).not.toHaveBeenCalled();
  });

  it("checks again after a failed check", () => {
    const handlers = renderDialog({ state: "error", message: "Could not reach GitHub." });
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(handlers.onCheck).toHaveBeenCalledTimes(1);
  });

  it("confirms the app is up to date", () => {
    renderDialog({ state: "up-to-date", checkedAt: "2026-10-30T12:00:00Z" });
    expect(screen.getByText(/latest version/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Updates" })).toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    const { container } = render(
      <UpdateDialog open={false} state={{ channel: "portable", currentVersion: "1.1.0", status: { state: "idle" } }} onClose={vi.fn()} onCheck={vi.fn()} onInstall={vi.fn()} onOpenReleasePage={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
