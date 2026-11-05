"use client";

import { Button } from "@heroui/react";
import { IconPrinter } from "@tabler/icons-react";

/** Opens the browser's print dialog, where "Save as PDF" makes a PDF copy. */
function PrintButton() {
  return (
    <Button variant="outline" onPress={() => window.print()}>
      <IconPrinter size={18} aria-hidden />
      Print or save as PDF
    </Button>
  );
}

export default PrintButton;
