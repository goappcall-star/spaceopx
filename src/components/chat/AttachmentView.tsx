import { Download, FileText } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatBytes, uploadsService } from "@/services/uploads";
import type { Attachment } from "@/types";

export function AttachmentView({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void uploadsService.signedUrl(attachment.path).then((signed) => {
      if (active) setUrl(signed);
    });
    return () => {
      active = false;
    };
  }, [attachment.path]);

  if (attachment.kind === "image") {
    return (
      <a href={url ?? undefined} target="_blank" rel="noreferrer" className="mt-1.5 block">
        {url ? (
          <img
            src={url}
            alt={attachment.name}
            loading="lazy"
            className="border-border max-h-72 rounded-lg border object-cover"
          />
        ) : (
          <div className="bg-muted h-40 w-64 animate-pulse rounded-lg" />
        )}
      </a>
    );
  }

  return (
    <div className="border-border bg-surface mt-1.5 flex max-w-sm items-center gap-3 rounded-lg border p-2.5">
      <FileText className="text-primary h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{attachment.name}</p>
        <p className="text-muted-foreground text-xs">{formatBytes(attachment.size)}</p>
      </div>
      <Button asChild size="icon" variant="ghost" className="h-8 w-8" disabled={!url}>
        <a href={url ?? undefined} target="_blank" rel="noreferrer" aria-label="Baixar anexo">
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}
