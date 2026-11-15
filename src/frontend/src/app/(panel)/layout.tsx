import type { ReactNode } from "react";
import { SessionPanel } from "../../frontend/components/layout/SessionPanel";
export default function PanelLayout({children}:{children:ReactNode}) { return <SessionPanel>{children}</SessionPanel>; }
