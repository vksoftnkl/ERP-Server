# Print client integration — Qt6 desktop, Next.js web, Expo mobile

The server renders; the clients fetch bytes and hand them to a printer. All
three share the same endpoint and the same output, which is the whole point of
server-side rendering — there is no duplicated print logic to drift.

```
GET /api/v1/reports/:docType/:docId/print
    ?paper=A4&mode=PDF&accYear=2026-2027[&templateId=&printerProfile=&branchId=]
```

`mode=PDF` returns `application/pdf`. `mode=ESCPOS` / `mode=ESCP_DOTMATRIX`
return `application/octet-stream` — raw printer bytes, ready to spool. Response
headers `X-Report-Template-Id/-Version/-Source` and `X-Report-Page-Count` are
there for the client to log when a print looks wrong; which template rendered a
document is the first question every time.

## Qt6 desktop

### PDF — QPdfDocument to QPrinter

```cpp
// Fetch the bytes (QNetworkAccessManager), then:
QPdfDocument doc;
QBuffer buffer(&pdfBytes);
buffer.open(QIODevice::ReadOnly);
doc.load(&buffer);

QPrinter printer(QPrinter::HighResolution);
printer.setPrinterName(selectedPrinter);          // A4/A5 laser or inkjet
QPainter painter(&printer);
for (int page = 0; page < doc.pageCount(); ++page) {
    if (page > 0) printer.newPage();
    const QSizeF sizePt = doc.pagePointSize(page);
    QImage image = doc.render(page, (sizePt * printer.resolution() / 72.0).toSize());
    painter.drawImage(printer.pageRect(QPrinter::DevicePixel), image);
}
painter.end();
```

### Raw thermal / dot matrix — Windows RAW spool

The renderer already produced device bytes; do NOT let a driver reinterpret
them. Open the queue in RAW datatype:

```cpp
HANDLE hPrinter;
if (!OpenPrinter(queueName, &hPrinter, nullptr)) return;
DOC_INFO_1 docInfo { const_cast<LPWSTR>(L"ERP Invoice"), nullptr,
                     const_cast<LPWSTR>(L"RAW") };   // <-- RAW is essential
StartDocPrinter(hPrinter, 1, reinterpret_cast<LPBYTE>(&docInfo));
StartPagePrinter(hPrinter);
DWORD written = 0;
WritePrinter(hPrinter, rawBytes.data(), rawBytes.size(), &written);
EndPagePrinter(hPrinter);
EndDocPrinter(hPrinter);
ClosePrinter(hPrinter);
```

Add a `NexPrintService` singleton alongside the existing `NexCrudMasterPage`
framework so every master/transaction screen prints the same way: it fetches
from the endpoint, inspects the `Content-Type`, and routes PDF to the
QPdfDocument path and octet-stream to the RAW spool path.

## Next.js web

Fetch the blob, open it in a hidden iframe, print from the iframe:

```ts
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const blob = await response.blob();
const objectUrl = URL.createObjectURL(blob);

const iframe = document.createElement('iframe');
iframe.style.display = 'none';
iframe.src = objectUrl;
document.body.appendChild(iframe);
iframe.onload = () => {
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  // Revoke after the print dialog has taken the blob.
  setTimeout(() => { URL.revokeObjectURL(objectUrl); iframe.remove(); }, 60_000);
};
```

Web only prints PDF — a browser cannot address a thermal or dot-matrix queue.
For those the web client shows the operator to use the desktop app.

## Expo mobile

Thermal only, over Bluetooth serial. Request `mode=ESCPOS`, get the raw bytes,
write them to the paired printer:

```ts
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const bytes = new Uint8Array(await response.arrayBuffer());
// react-native-bluetooth-escpos-printer or a BLE serial characteristic write:
await BluetoothEscposPrinter.write(bytes);   // bytes are already ESC/POS
```

The bytes are complete — init, code page, cut are all in the stream — so the
mobile client does not construct any ESC/POS itself. It is a pipe.

## Choosing paper and mode

The client picks `mode` and `paper` from the printer the user selected, and the
server resolves the template. A sensible client default:

| Selected printer | mode | paper |
|---|---|---|
| A4/A5 laser or inkjet | `PDF` | `A4` / `A5` |
| 80 mm thermal | `ESCPOS` | `T80` |
| 58 mm thermal | `ESCPOS` | `T58` |
| 80-col dot matrix | `ESCP_DOTMATRIX` | `DM80` |
| 132-col dot matrix | `ESCP_DOTMATRIX` | `DM132` |

Pass `printerProfile` when the site has a model-specific profile (see
`docs/reporting-printer-inventory.md`); omit it to use the built-in Epson
defaults.
