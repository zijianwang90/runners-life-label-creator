import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { LabelSvg, labelScaleProps } from "../components/LabelSvg";
import type { CalibrationSettings, LabelSize, PrintPayload, ShoeLabel } from "../types";
import { expandLabelCopies, paginate } from "../utils/labels";
import { a4Layout, clampLabelSize, clampTextScale, formatLabelSize, formatMm } from "../utils/labelSize";

interface JobState { jobId: string; payload: PrintPayload }

const calibratedStyle = (calibration: CalibrationSettings): CSSProperties => ({
  transformOrigin: "top left",
  transform: `translate(${calibration.offsetXmm}mm, ${calibration.offsetYmm}mm) scale(${calibration.scaleX}, ${calibration.scaleY})`
});

const textScaleProps = (payload: PrintPayload) => labelScaleProps({
  modelTextScale: clampTextScale("model", payload.modelTextScale),
  featureTextScale: clampTextScale("feature", payload.featureTextScale),
  priceTextScale: clampTextScale("price", payload.priceTextScale),
  regularPriceTextScale: clampTextScale("regular", payload.regularPriceTextScale),
  saleSealScale: clampTextScale("seal", payload.saleSealScale)
});

function CropMarks() {
  return <><i className="crop-mark left" /><i className="crop-mark right" /></>;
}

function CustomLabels({ labels, payload, size }: { labels: ShoeLabel[]; payload: PrintPayload; size: LabelSize }) {
  return <>{labels.map((shoe, index) => (
    <section className="custom-print-page" key={`${shoe.id}-${index}`}>
      <div className="calibrated-label" style={calibratedStyle(payload.calibration)}>
        <LabelSvg shoe={shoe} currencySymbol={payload.currencySymbol} size={size} {...textScaleProps(payload)} />
      </div>
    </section>
  ))}</>;
}

function A4Labels({ labels, payload, size }: { labels: ShoeLabel[]; payload: PrintPayload; size: LabelSize }) {
  const layout = a4Layout(size);
  const pages = paginate(labels, layout.perPage);
  const stackStyle: CSSProperties = { left: `${layout.leftMm}mm`, top: `${layout.topMm}mm`, height: `${layout.stackHeightMm}mm` };
  return <>{pages.map((page, pageIndex) => (
    <section className="a4-print-page" key={pageIndex}>
      <div className="a4-label-stack" style={stackStyle}>
        {page.map((shoe, index) => (
          <div className="a4-label-slot" key={`${shoe.id}-${index}`}>
            <CropMarks />
            <div className="calibrated-label" style={calibratedStyle(payload.calibration)}>
              <LabelSvg shoe={shoe} currencySymbol={payload.currencySymbol} size={size} {...textScaleProps(payload)} />
            </div>
          </div>
        ))}
      </div>
    </section>
  ))}</>;
}

function CalibrationDocument({ payload, size }: { payload: PrintPayload; size: LabelSize }) {
  const title = `RUNNERS LIFE — ${formatLabelSize(size)} CALIBRATION`;
  if (payload.mode === "custom") {
    return (
      <section className="custom-print-page calibration-page custom-calibration">
        <div className="calibration-frame" style={calibratedStyle(payload.calibration)}>
          <strong>{title}</strong>
          <span className="measure-width">{formatMm(size.widthMm)} mm</span><span className="measure-height">{formatMm(size.heightMm)} mm</span>
          <div className="hundred-mm-line">100 mm</div>
        </div>
      </section>
    );
  }
  return (
    <section className="a4-print-page calibration-page a4-calibration">
      <div className="calibration-frame" style={calibratedStyle(payload.calibration)}>
        <strong>{title}</strong>
        <span className="measure-width">{formatMm(size.widthMm)} mm</span><span className="measure-height">{formatMm(size.heightMm)} mm</span>
      </div>
      <div className="hundred-mm-ruler"><span>0</span><strong>100 mm reference</strong><span>100</span></div>
      <p>Measure the outer label frame and the 100 mm reference line. Enter any correction in Printer calibration.</p>
    </section>
  );
}

export function PrintRoot() {
  const [job, setJob] = useState<JobState | null>(null);
  useEffect(() => window.electronAPI?.onPrintPayload((jobId, payload) => setJob({ jobId, payload })), []);
  const labels = useMemo(() => job ? expandLabelCopies(job.payload.labels) : [], [job]);

  useEffect(() => {
    if (!job) return;
    let canceled = false;
    const ready = async () => {
      await document.fonts?.ready;
      await Promise.all(Array.from(document.images).map((image) => image.complete ? Promise.resolve() : image.decode().catch(() => undefined)));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      if (!canceled) window.electronAPI?.notifyPrintReady(job.jobId);
    };
    void ready();
    return () => { canceled = true; };
  }, [job]);

  if (!job) return <div className="print-loading">Preparing print document…</div>;
  const { payload } = job;
  const size = clampLabelSize(payload.labelSize);
  const sizeVars = { "--label-w": `${size.widthMm}mm`, "--label-h": `${size.heightMm}mm` } as CSSProperties;
  return (
    <div className={`print-document mode-${payload.mode}`} style={sizeVars}>
      <style>{payload.mode === "custom"
        ? `@page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }`
        : "@page { size: A4 landscape; margin: 0; }"}</style>
      {payload.kind === "calibration" ? <CalibrationDocument payload={payload} size={size} />
        : payload.mode === "custom" ? <CustomLabels labels={labels} payload={payload} size={size} />
          : <A4Labels labels={labels} payload={payload} size={size} />}
    </div>
  );
}
