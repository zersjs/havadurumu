"use client";

import type { ReactNode } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import trTR from "@astryxdesign/core/locales/tr-TR.json";
import { themes, defaultThemeSlug } from "../astryx-themes";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <InternationalizationProvider locale="tr-TR" messages={{ "tr-TR": trTR }}>
      <Theme theme={themes[defaultThemeSlug]}>{children}</Theme>
    </InternationalizationProvider>
  );
}
