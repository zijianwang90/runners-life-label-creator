import type { GiftCertificate } from "../types";

export function todayReference(date = new Date()): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

export function createGiftCertificate(signer = ""): GiftCertificate {
  return { amount: "", to: "", from: "", signer, ref: todayReference() };
}

export function validCertificateAmount(amount: string): boolean {
  return /^\d{1,6}(\.\d{1,2})?$/.test(amount.trim()) && Number(amount) > 0;
}

export function certificateError(certificate: GiftCertificate): string | null {
  if (!validCertificateAmount(certificate.amount)) return "Enter an amount greater than $0, up to $999,999.99 (at most two decimal places).";
  if (!certificate.ref.trim() || certificate.ref.length > 40) return "Enter a Ref # of up to 40 characters.";
  if ([certificate.to, certificate.from, certificate.signer].some((value) => value.length > 60)) return "Names and signatures must be 60 characters or fewer.";
  return null;
}

export function certificateAmount(amount: string): string {
  if (!validCertificateAmount(amount)) return "$ —";
  return `$${Number(amount).toLocaleString("en-CA", { minimumFractionDigits: amount.includes(".") ? 2 : 0, maximumFractionDigits: 2 })}`;
}
