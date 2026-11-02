import { runnersLifeLogo } from "../assets";
import type { GiftCertificate } from "../types";
import { certificateAmount } from "../utils/giftCertificate";

// Use the same vector document for the live preview and the printed Letter page.
function fittedSize(text: string, preferred: number, width: number): number {
  const units = Array.from(text).reduce((sum, character) => sum + (/[^\u0000-ÿ]/.test(character) ? 1 : 0.65), 0);
  return Math.min(preferred, width / Math.max(1, units));
}

export function GiftCertificateSvg({ certificate }: { certificate: GiftCertificate }) {
  const amount = certificateAmount(certificate.amount);
  return (
    <svg className="gift-certificate-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 816 1056" role="img" aria-label="Gift certificate preview">
      <rect width="816" height="1056" fill="#fff" />
      <rect x="48" y="48" width="720" height="960" fill="none" stroke="#d50920" strokeWidth="2" />
      <image href={runnersLifeLogo} x="156" y="92" width="470" height="155" />
      <g fill="#17181b" fontFamily="Arial, 'Microsoft YaHei', sans-serif">
        <text x="408" y="318" textAnchor="middle" fontFamily="'Barlow Condensed', Arial, sans-serif" fontWeight="800" fontSize="64" letterSpacing="4">GIFT CERTIFICATE</text>
        <text x="408" y="385" textAnchor="middle" fontSize="21">Redeemable at Runner’s Life in the amount of</text>
        <text x="408" y="524" textAnchor="middle" fontFamily="'Barlow Condensed', Arial, sans-serif" fontWeight="800" fontSize={fittedSize(amount, 142, 570)} fill="#d50920">{amount}</text>
        <text x="408" y="570" textAnchor="middle" fontFamily="'Barlow Condensed', Arial, sans-serif" fontWeight="600" fontSize="30" letterSpacing="4">DOLLARS</text>
        <text x="112" y="668" fontSize="22">To:</text>
        <text x="204" y="666" fontSize={fittedSize(certificate.to, 30, 490)}>{certificate.to}</text>
        <text x="112" y="738" fontSize="22">From:</text>
        <text x="204" y="736" fontSize={fittedSize(certificate.from, 30, 490)}>{certificate.from}</text>
        <text x="116" y="909" fontFamily="'Dancing Script', 'Microsoft YaHei', cursive" fontWeight="600" fontSize={fittedSize(certificate.signer, 40, 290)}>{certificate.signer}</text>
        <text x="112" y="951" fontSize="16">Signature</text>
        <text x="704" y="909" textAnchor="end" fontFamily="'Barlow Condensed', Arial, sans-serif" fontWeight="600" fontSize={fittedSize(certificate.ref, 30, 245)}>{certificate.ref}</text>
        <text x="704" y="951" textAnchor="end" fontSize="16">Ref #</text>
      </g>
      <g stroke="#17181b" strokeWidth="1.5">
        <path d="M200 678H704 M200 748H704 M112 922H416" />
      </g>
    </svg>
  );
}
