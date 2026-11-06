import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { btnGhost } from "@/lib/styles";

export function QrCard({ url, slug }: { url: string; slug: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { margin: 1, width: 320, errorCorrectionLevel: "M" })
      .then((value) => {
        if (active) setSrc(value);
      })
      .catch(() => {
        if (active) setError("The QR code could not be created.");
      });
    return () => {
      active = false;
    };
  }, [url]);

  return (
    <div>
      {src ? <img src={src} alt={`QR code for ${url}`} className="h-44 w-44 rounded-xl bg-white p-2" /> : null}
      {error ? <p className="text-sm text-bad">{error}</p> : null}
      {src ? (
        <a className={`${btnGhost} mt-3`} href={src} download={`${slug}-review-qr.png`}>
          Download QR code
        </a>
      ) : null}
    </div>
  );
}
