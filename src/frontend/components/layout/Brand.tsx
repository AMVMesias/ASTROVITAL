import Link from "next/link";
import Image from "next/image";
export function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${footer ? "brand-footer" : ""}`}
      aria-label="NASA Health, inicio"
    >
      <Image
        src="/images/nasa-logo.svg"
        alt="NASA"
        width={80}
        height={68}
        priority
      />
      <span>
        NASA Health
        {footer && (
          <small>
            Monitoreo y bienestar de astronautas
            <br />
            en misiones espaciales.
          </small>
        )}
      </span>
    </Link>
  );
}
