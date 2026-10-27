import runnersLifeLogoUrl from "../logo.svg";
import newBalanceLogoUrl from "../design/assets/brands/new-balance.svg";
import sauconyLogoUrl from "../design/assets/brands/saucony.svg";
import asicsLogoUrl from "../design/assets/brands/asics.svg";
import brooksLogoUrl from "../design/assets/brands/brooks.svg";
import type { BrandId } from "./types";

export const runnersLifeLogo = runnersLifeLogoUrl;

export const brandLogos: Record<BrandId, string> = {
  "new-balance": newBalanceLogoUrl,
  saucony: sauconyLogoUrl,
  asics: asicsLogoUrl,
  brooks: brooksLogoUrl
};

export const brandNames: Record<BrandId, string> = {
  "new-balance": "New Balance",
  saucony: "Saucony",
  asics: "ASICS",
  brooks: "Brooks"
};
