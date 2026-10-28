import { useId } from "react";
import designTokens from "../../design/label-design-system.json";
import { brandLogos, runnersLifeLogo } from "../assets";
import type { LabelSize, ShoeLabel, TextScales } from "../types";
import { featureFontSize, formatMoney, getPriceState, modelFontSize, moneyParts, savingsAmount, specSegments } from "../utils/labels";
import { BASE_DESIGN_WIDTH, computeLabelLayout, DESIGN_HEIGHT, designWidth, estimateTextWidth, fitText } from "../utils/labelLayout";
import { clampTextScale, DEFAULT_LABEL_SIZE } from "../utils/labelSize";

const LABEL_FONT = '"Barlow Condensed", "Arial Narrow", "Segoe UI", Arial, sans-serif';

interface PriceAmountProps {
  value: number | null;
  currencySymbol: string;
  x: number;
  y: number;
  integerSize: number;
  currencySize: number;
  centsSize: number;
}

function PriceAmount({ value, currencySymbol, x, y, integerSize, currencySize, centsSize }: PriceAmountProps) {
  const { whole, cents } = moneyParts(value);
  const symbol = currencySymbol.trim() || "$";
  const fittedCurrencySize = symbol.length > 1 ? Math.min(currencySize, 23) : currencySize;
  const lift = Math.round(integerSize * 0.27);

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill="#fff"
      fontFamily={LABEL_FONT}
      fontWeight="900"
      letterSpacing="-1.5"
      style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
    >
      <tspan fontSize={fittedCurrencySize} dy={-lift} letterSpacing="0">{symbol}</tspan>
      <tspan fontSize={integerSize} dy={lift}>{whole}</tspan>
      {cents && <tspan fontSize={centsSize}>{cents}</tspan>}
    </text>
  );
}

interface LabelSvgProps {
  shoe: ShoeLabel;
  currencySymbol?: string;
  /** Physical label size; only its aspect ratio changes the layout, the rest is plain scaling. */
  size?: LabelSize;
  /** Size of the model name relative to the approved design; 1 draws exactly the approved label. */
  modelScale?: number;
  /** Size of the selling points relative to the approved design; 1 draws exactly the approved label. */
  featureScale?: number;
  /** Size of the price relative to the approved design; 1 draws exactly the approved label. */
  priceScale?: number;
  /** Size of the struck-through regular price on sale labels; 1 draws exactly the approved label. */
  regularScale?: number;
  /** Size of the SALE seal; 1 draws exactly the approved label. */
  sealScale?: number;
  className?: string;
  title?: string;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** The saved sizes as `LabelSvg` props. */
export const labelScaleProps = (scales: TextScales) => ({
  modelScale: scales.modelTextScale,
  featureScale: scales.featureTextScale,
  priceScale: scales.priceTextScale,
  regularScale: scales.regularPriceTextScale,
  sealScale: scales.saleSealScale
});
/** The spec row is a little smaller than the selling points and follows their size slider. */
const SPEC_BASE_SIZE = 18;
const SPEC_LETTER_SPACING = 0.6;
/** Drawn in red between the specs; the spaces around it are part of the separator. */
const SPEC_SEPARATOR = "  •  ";

/** The spec row's font size: the standard size whenever it fits, otherwise just small enough to fit. */
function specRowSize(segments: string[], maxWidth: number, featureScale: number): number {
  const baseSize = round(SPEC_BASE_SIZE * featureScale);
  const width = estimateTextWidth(segments.join(SPEC_SEPARATOR), baseSize, 600, SPEC_LETTER_SPACING);
  return width <= maxWidth ? baseSize : Math.floor(((baseSize * maxWidth) / width) * 10) / 10;
}

const PRICE_POLYGON = [[1730, 0], [2200, 0], [2200, 230], [1668, 230]] as const;

export function LabelSvg({ shoe, currencySymbol = "$", size = DEFAULT_LABEL_SIZE, modelScale = 1, featureScale = 1, priceScale = 1, regularScale = 1, sealScale = 1, className = "", title }: LabelSvgProps) {
  const rawId = useId().replace(/:/g, "");
  const speedPatternId = `speed-${rawId}`;
  const runnerClipId = `runner-${rawId}`;
  const runnerWhiteFilterId = `runner-white-${rawId}`;
  const redGradientId = `red-${rawId}`;
  const priceState = getPriceState(shoe);
  const displayedPrice = priceState === "sale" ? shoe.salePrice : shoe.regularPrice;
  const features = shoe.features.map((feature) => feature.trim()).filter(Boolean).slice(0, 3);
  const specs = specSegments(shoe.specs).map((segment) => segment.toUpperCase());
  const layout = computeLabelLayout(designWidth(size), features.length, specs.length > 0);
  const textScale = clampTextScale("feature", featureScale);
  const modelTextScale = clampTextScale("model", modelScale);
  const priceTextScale = clampTextScale("price", priceScale);
  const priceSize = (approved: number) => round(approved * priceTextScale);
  // The struck-through "REG." price grows upwards from its baseline; the strike stays through its middle and
  // at least as long as the approved 168-unit line.
  const regularText = `REG. ${formatMoney(shoe.regularPrice, currencySymbol)}`;
  const regularSize = round(18 * clampTextScale("regular", regularScale));
  const strikeHalf = round(Math.max(168, estimateTextWidth(regularText, regularSize, 600) + 24) / 2);
  const strikeY = round(45 - (regularSize * 7) / 18);
  // The divider between selling points grows with their text: 140–170 at the approved 21-unit size.
  const separatorTop = round(layout.featureY - 22 * textScale);
  const separatorBottom = round(layout.featureY + 8 * textScale);
  const specSize = layout.specs ? specRowSize(specs, layout.specs.maxWidth, textScale) : 0;
  const canvasWidth = round(layout.width);
  const modelText = (shoe.model || "SHOE MODEL").toUpperCase();
  const modelFit = fitText(modelText, {
    baseSize: round(modelFontSize(shoe.model) * modelTextScale),
    maxWidth: layout.model.maxWidth,
    weight: 800,
    letterSpacing: designTokens.typography.model.letterSpacing,
    minRatio: Math.min(0.8, 0.8 / modelTextScale)
  });

  const brandConfig = designTokens.brandLogos.brands[shoe.brand];
  const [artX, artY, artWidth, artHeight] = designTokens.brandLogos.artBounds;
  const brandWidth = artWidth * brandConfig.opticalScale;
  const brandHeight = artHeight * brandConfig.opticalScale;
  const brandX = artX + (artWidth - brandWidth) / 2 + brandConfig.opticalOffsetX;
  const brandY = artY + (artHeight - brandHeight) / 2 + brandConfig.opticalOffsetY;
  const mark = designTokens.layout.runnersLifeMarkRegion;
  const seal = designTokens.pricingStates.sale.saleSeal;
  // The seal grows down and to the right so its top stays inside the label and its left side stays clear of the text.
  const sealSize = clampTextScale("seal", sealScale);
  const sealReach = seal.outerRadius + seal.outerStrokeWidth / 2;
  const sealX = round(seal.centerX + seal.outerRadius * (sealSize - 1) * 0.5);
  const sealY = round(seal.centerY + sealReach * (sealSize - 1));
  const runnerImageWidth = mark.symbolBounds.height * (440.2 / 144.6);

  // On labels narrower than the approved one the logo and price blocks shrink. Their shapes narrow in x
  // only; their content scales uniformly about the label's vertical centre so nothing is stretched.
  const squeeze = layout.squeeze;
  const centreShift = round((DESIGN_HEIGHT / 2) * (1 - squeeze));
  const leftPolygon = mark.polygon.map(([x, y]) => `${round(x * squeeze)},${y}`).join(" ");
  const pricePolygon = PRICE_POLYGON.map(([x, y]) => `${round(layout.width - (BASE_DESIGN_WIDTH - x) * squeeze)},${y}`).join(" ");
  const leftContentTransform = `translate(0 ${centreShift}) scale(${round(squeeze)})`;
  const priceContentTransform = `translate(${round(layout.width)} ${centreShift}) scale(${round(squeeze)}) translate(${-BASE_DESIGN_WIDTH} 0)`;

  return (
    <svg
      className={`label-svg ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${canvasWidth} ${DESIGN_HEIGHT}`}
      role="img"
      aria-label={title ?? `${shoe.brand} ${shoe.model} label`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={redGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={designTokens.palette.runnersLifeRedLight} />
          <stop offset="1" stopColor={designTokens.palette.runnersLifeRedDark} />
        </linearGradient>
        <pattern id={speedPatternId} width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(24)">
          <line x1="0" y1="0" x2="0" y2="18" stroke="#fff" strokeWidth="1" opacity="0.08" />
        </pattern>
        <clipPath id={runnerClipId}>
          <rect
            x={mark.symbolBounds.x}
            y={mark.symbolBounds.y}
            width={mark.symbolBounds.width}
            height={mark.symbolBounds.height}
          />
        </clipPath>
        <filter id={runnerWhiteFilterId} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 0 1
                    0 0 0 1 0"
          />
        </filter>
      </defs>

      <rect width={canvasWidth} height={DESIGN_HEIGHT} fill="#fff" />
      <rect x="1" y="1" width={round(layout.width - 2)} height="228" fill="none" stroke={designTokens.canvas.border.color} strokeWidth="2" />
      <polygon points={leftPolygon} fill={`url(#${redGradientId})`} />
      <polygon points={leftPolygon} fill={`url(#${speedPatternId})`} />
      <g transform={leftContentTransform}>
        <image
          href={runnersLifeLogo}
          x={mark.symbolBounds.x}
          y={mark.symbolBounds.y}
          width={runnerImageWidth}
          height={mark.symbolBounds.height}
          preserveAspectRatio="xMinYMid meet"
          clipPath={`url(#${runnerClipId})`}
          filter={`url(#${runnerWhiteFilterId})`}
        />
        <image
          href={brandLogos[shoe.brand]}
          x={brandX}
          y={brandY}
          width={brandWidth}
          height={brandHeight}
          preserveAspectRatio="xMidYMid meet"
        />
        <line x1="600" y1="42" x2="600" y2="188" stroke={designTokens.palette.divider} strokeWidth="2" />
      </g>

      <text
        x={layout.model.x}
        y={layout.model.y}
        fill={designTokens.palette.ink}
        fontFamily={LABEL_FONT}
        fontSize={modelFit.fontSize}
        fontWeight="800"
        letterSpacing="-1.1"
        textLength={modelFit.textLength}
        lengthAdjust={modelFit.textLength ? "spacingAndGlyphs" : undefined}
      >
        {modelText}
      </text>

      {features.map((feature, index) => {
        const slot = layout.features[index];
        const fit = fitText(feature, {
          baseSize: round(featureFontSize(feature) * textScale),
          maxWidth: slot.maxWidth,
          weight: 600,
          // Never shrink below what the approved design would have used, however large the wish.
          minRatio: Math.min(0.8, 0.8 / textScale)
        });
        return (
          <text
            key={`${index}-${feature}`}
            x={round(slot.x)}
            y={layout.featureY}
            fill={designTokens.palette.bodyText}
            fontFamily={LABEL_FONT}
            fontSize={fit.fontSize}
            fontWeight="600"
            textLength={fit.textLength}
            lengthAdjust={fit.textLength ? "spacingAndGlyphs" : undefined}
          >
            {feature.toUpperCase()}
          </text>
        );
      })}
      {layout.separatorXs.map((x) => (
        <line key={x} x1={round(x)} y1={separatorTop} x2={round(x)} y2={separatorBottom} stroke={designTokens.palette.runnersLifeRed} strokeWidth="2" />
      ))}

      {layout.specs && (
        <text
          x={round(layout.specs.x)}
          y={layout.specs.y}
          fill={designTokens.palette.ink}
          fontFamily={LABEL_FONT}
          fontSize={specSize}
          fontWeight="600"
          letterSpacing={SPEC_LETTER_SPACING}
          style={{ fontVariantNumeric: "tabular-nums lining-nums", whiteSpace: "pre" }}
        >
          {specs.map((segment, index) => (
            <tspan key={`${index}-${segment}`}>
              {index > 0 && <tspan fill={designTokens.palette.runnersLifeRed}>{SPEC_SEPARATOR}</tspan>}
              {segment}
            </tspan>
          ))}
        </text>
      )}

      <polygon points={pricePolygon} fill={`url(#${redGradientId})`} />
      <polygon points={pricePolygon} fill={`url(#${speedPatternId})`} />
      <g transform={priceContentTransform}>

        {priceState === "sale" ? (
          <>
            <g transform={`translate(${sealX} ${sealY}) rotate(${seal.rotationDegrees}) scale(${sealSize})`}>
              <circle r={seal.outerRadius} fill={seal.fill} stroke={seal.outerStroke} strokeWidth={seal.outerStrokeWidth} />
              <circle
                r={seal.innerRadius}
                fill="none"
                stroke={seal.innerStroke}
                strokeWidth={seal.innerStrokeWidth}
                strokeDasharray={seal.innerStrokeDashArray.join(" ")}
              />
              <text
                x="0"
                y="12"
                textAnchor="middle"
                fill={seal.textColor}
                fontFamily={LABEL_FONT}
                fontSize={seal.fontSize}
                fontWeight={seal.fontWeight}
                letterSpacing="2"
              >
                SALE
              </text>
            </g>
            <text
              x="2025"
              y="45"
              textAnchor="middle"
              fill="#fff"
              fontFamily={LABEL_FONT}
              fontSize={regularSize}
              fontWeight="600"
              style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
            >
              {regularText}
            </text>
            <line x1={round(2025 - strikeHalf)} y1={strikeY} x2={round(2025 + strikeHalf)} y2={strikeY} stroke="#fff" strokeWidth="2" />
            <PriceAmount
              value={displayedPrice}
              currencySymbol={currencySymbol}
              x={1980}
              y={137}
              integerSize={priceSize(82)}
              currencySize={priceSize(34)}
              centsSize={priceSize(46)}
            />
            <rect x="1867" y="158" width="226" height="40" fill="#fff" />
            <text
              x="1980"
              y="186"
              textAnchor="middle"
              fill="#c7081a"
              fontFamily={LABEL_FONT}
              fontSize="23"
              fontWeight="800"
              letterSpacing="1.7"
              style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
            >
              SAVE {formatMoney(savingsAmount(shoe), currencySymbol)}
            </text>
          </>
        ) : (
          <PriceAmount
            value={displayedPrice}
            currencySymbol={currencySymbol}
            x={1950}
            y={157}
            integerSize={priceSize(88)}
            currencySize={priceSize(36)}
            centsSize={priceSize(50)}
          />
        )}
      </g>
    </svg>
  );
}
