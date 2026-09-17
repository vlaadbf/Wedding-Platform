'use client';
import { useEffect, useState, useRef } from 'react';
import { Data, parseCSV } from '@/lib/domain';
import { Pick } from './controls';
import { Button } from '@/components/ui/button';
export function QRCode({ value }: { value: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    import('qrcode')
      .then((q) =>
        q.toDataURL(value, {
          width: 220,
          margin: 2,
          color: { dark: '#42563cff', light: '#ffffffff' },
        }),
      )
      .then(setSrc).catch(() => setSrc(''));
  }, [value]);
  return src ? (
    // The QR code is already a generated data URL and cannot use an image loader.
    // oxlint-disable-next-line next/no-img-element
    <img
      src={src}
      width={220}
      height={220}
      alt="Cod QR cu identificator opac pentru invitație"
    />
  ) : null;
}
export async function readSpreadsheet(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error('Fișierul depășește 5 MB.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) return file.text();
  const ExcelJS = (await import('exceljs/dist/exceljs.min.js')).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.worksheets[0];
  if (!sheet) throw new Error('Fișierul nu conține foi.');
  if (sheet.rowCount > 151)
    throw new Error('Maximum 150 de persoane per import.');
  const rows: string[][] = [];
  sheet.eachRow((row: import("exceljs").Row) => {
    const cells: string[] = [];
    for (let i = 1; i <= Math.min(row.cellCount, 30); i++)
      cells.push(row.getCell(i).text);
    rows.push(cells);
  });
  return rows
    .map((r) => r.map((v) => '"' + v.replace(/"/g, '""') + '"').join(','))
    .join('\n');
}
export function ColumnMapping({
  text,
  mapping,
  onChange,
}: {
  text: string;
  mapping: Data;
  onChange: (d: Data) => void;
}) {
  let header: string[] = [];
  try {
    header = parseCSV(text.replace(/^\uFEFF/, '')).shift() || [];
  } catch {
    return null;
  }
  return (
    <div className="form-grid">
      {[
        ['name', 'Nume și prenume'],
        ['family', 'Familie'],
        ['email', 'Email'],
        ['phone', 'Telefon'],
        ['age', 'Adult / copil'],
      ].map(([key, label]) => (
        <div className="form-field" key={key}>
          <label>{label}</label>
          <Pick
            label="Coloană sursă"
            value={mapping[key] ?? (header.includes(key) ? key : '')}
            onChange={(v) => onChange({ ...mapping, [key]: v })}
            options={[
              { value: '', label: 'Nu importa' },
              ...header.map((h) => ({ value: h, label: h })),
            ]}
          />
        </div>
      ))}
    </div>
  );
}
export function QRScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement | null>(null),
    stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState(''),
    [active, setActive] = useState(false);
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
    setActive(false);
  };
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  const start = async () => {
    try {
      const Detector = (window as Window & { BarcodeDetector?: new (options: { formats: string[] }) => { detect(video: HTMLVideoElement): Promise<{rawValue: string}[]> } }).BarcodeDetector;
      if (!Detector)
        throw new Error(
          'Scanarea QR nu este disponibilă în acest browser. Poți folosi cititorul extern sau căutarea după nume.',
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setActive(true);
      const detector = new Detector({ formats: ['qr_code'] });
      timer.current = setInterval(async () => {
        if (video.current?.readyState === 4) {
          const codes = await detector.detect(video.current);
          if (codes.length) {
            stop();
            onCode(codes[0].rawValue);
          }
        }
      }, 500);
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : 'Camera nu este disponibilă.');
    }
  };
  return (
    <div>
      <video
        ref={video}
        muted
        playsInline
        style={{
          width: '100%',
          maxHeight: 240,
          display: active ? 'block' : 'none',
        }}
      />
      {error && <p className="form-error">{error}</p>}
      <Button variant="outline" onClick={active ? stop : start}>
        {active ? 'Oprește camera' : 'Scanează un cod QR'}
      </Button>
    </div>
  );
}
