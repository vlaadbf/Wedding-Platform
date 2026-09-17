declare module 'qrcode' { export function toDataURL(text: string, options?: { width?: number; margin?: number; color?: { dark: string; light: string } }): Promise<string>; }
declare module 'exceljs/dist/exceljs.min.js' { const ExcelJS: typeof import('exceljs'); export default ExcelJS; }
