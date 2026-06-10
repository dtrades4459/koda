import type { ImgHTMLAttributes } from "react";
import { useSignedUrl } from "../hooks/useSignedUrl";

/** Drop-in <img> replacement for screenshots stored as bucket URLs.
 *  Resolves the src to a short-lived signed URL before rendering. */
export function SignedImg(props: ImgHTMLAttributes<HTMLImageElement>) {
  const { src, alt = "", ...rest } = props;
  const resolved = useSignedUrl(src);
  if (!resolved) return null;
  return <img src={resolved} alt={alt} {...rest} />;
}
