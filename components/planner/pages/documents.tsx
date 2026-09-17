'use client';
import { memo } from 'react';
import { Download, FileText, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Data } from '@/lib/domain';
import { Empty, scopedUrl } from '../controls';

export const DocumentsPage = memo(function DocumentsPage({ data, base, add }: { data: Data; base: string; add: () => void }) {
  return <>
    <div className="info-banner"><ShieldCheck />Fișiere private. O copie de contract încărcată nu reprezintă o semnătură electronică.</div>
    <div className="section-toolbar"><p>Oferte, contracte și detaliile importante.</p><Button onClick={add}><Upload />Încarcă document</Button></div>
    <div className="report-grid">
      {data.items?.map((document: Data) => (
        <a className="panel export-card" key={document.id} href={scopedUrl(base + '/documents/' + document.id)}>
          <FileText /><span>{document.name}<small>{Math.ceil(document.size / 1024)} KB · versiunea {document.version}</small></span><Download />
        </a>
      ))}
    </div>
    {!data.items?.length && <Empty title="Toate documentele, în siguranță" text="Adaugă primul PDF, JPG, PNG sau TXT (maximum 5 MB)." />}
  </>;
});
