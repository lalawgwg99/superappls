
import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { normalizeData } from '../utils/dataProcessor';
import { SalesRecord } from '../types';

interface InputSectionProps {
  onDataLoaded: (data: SalesRecord[], fileName: string) => void;
  isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onDataLoaded, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileInfo, setFileInfo] = useState<string | null>(null);

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const allRows: any[] = [];
    const fileNames: string[] = [];

    // Simple check for Excel/CSV
    const validFiles = fileArray.filter(f => 
        f.name.endsWith('.csv') || 
        f.name.endsWith('.xlsx') || 
        f.name.endsWith('.xls')
    );

    if (validFiles.length === 0) {
        alert("請上傳有效的 Excel (.xlsx, .xls) 或 CSV 檔案");
        return;
    }

    const readFile = (file: File): Promise<any[]> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = e.target?.result;
          if (data) {
            try {
              const workbook = XLSX.read(data, { type: 'binary' });
              const firstSheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[firstSheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet);
              resolve(jsonData);
            } catch (err) {
              console.error(`Error parsing ${file.name}:`, err);
              resolve([]);
            }
          } else {
            resolve([]);
          }
        };
        reader.readAsBinaryString(file);
      });
    };

    try {
        const promises = validFiles.map(f => {
            fileNames.push(f.name);
            return readFile(f);
        });

        const results = await Promise.all(promises);
        results.forEach(json => allRows.push(...json));

        if (allRows.length === 0) {
            alert("無法讀取資料，請檢查檔案內容");
            return;
        }
        
        // Merging handles deduplication logic internally within normalizeData
        const cleanRecords = normalizeData(allRows);
        
        setFileInfo(`${validFiles.length} 個檔案: ${fileNames.join(', ')}`);
        onDataLoaded(cleanRecords, fileNames.join(', '));
    } catch (err) {
        console.error("Batch processing error:", err);
        alert("檔案處理失敗");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 mb-8">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">資料匯入中心</h2>
        <p className="text-gray-500 mt-2">支援多檔案上傳與自動合併 (CSV, XLSX)</p>
      </div>

      <div 
        className={`
          relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'}
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          multiple
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={handleChange}
        />
        
        <div className="bg-blue-100 p-4 rounded-full mb-4">
          {isLoading ? (
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          ) : fileInfo ? (
             <FileSpreadsheet className="w-8 h-8 text-green-600" />
          ) : (
             <div className="relative">
                 <Upload className="w-8 h-8 text-blue-600" />
                 <div className="absolute -bottom-1 -right-1 bg-white rounded-full">
                    <Plus className="w-4 h-4 text-blue-600" />
                 </div>
             </div>
          )}
        </div>

        {fileInfo ? (
          <div className="text-center">
            <p className="text-green-700 font-bold text-lg mb-1">上傳成功</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto truncate" title={fileInfo}>{fileInfo}</p>
            <p className="text-sm text-gray-500 mt-1">解析完成，正在進行智能分析...</p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-gray-700">拖放多個檔案至此，或</p>
            <label htmlFor="file-upload" className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors font-medium shadow-sm">
              瀏覽檔案
            </label>
            <p className="text-xs text-gray-400 mt-4">
              系統將自動合併並去除重複商品名稱 (若在同一筆交易中)
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InputSection;
