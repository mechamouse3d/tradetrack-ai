import React, { useState } from 'react';
import { Upload, X, FileText, Loader2, AlertCircle } from 'lucide-react';
import { parseDocumentsWithAI } from '../services/geminiService';
import { Transaction } from '../types';

interface FileImportModalProps {
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  onClose: () => void;
}

interface FileWithPreview {
  file: File;
}

const FileImportModal: React.FC<FileImportModalProps> = ({ onImport, onClose }) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
    // Reset value to allow selecting the same file again if needed
    e.target.value = '';
  };

  const getMimeType = (file: File) => {
    // Trust the browser if it's specific
    if (file.type && file.type !== 'application/octet-stream') return file.type;
    
    // Fallback to extension inference
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) return 'text/csv';
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.webp')) return 'image/webp';
    
    return 'application/octet-stream';
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles: File[] = [];
    let errorMessage = null;

    newFiles.forEach(file => {
        // 1. Check Size (10MB Limit)
        if (file.size > 10 * 1024 * 1024) {
            errorMessage = `File ${file.name} is too large. Max size is 10MB.`;
            return;
        }

        // 2. Check Type
        const type = file.type;
        const name = file.name.toLowerCase();
        const isValidType = (
            type === 'application/pdf' || name.endsWith('.pdf') ||
            type.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') ||
            type === 'text/csv' || type === 'application/vnd.ms-excel' || name.endsWith('.csv')
        );

        if (isValidType) {
            validFiles.push(file);
        } else {
            errorMessage = `File ${file.name} has an unsupported format.`;
        }
    });
    
    if (errorMessage) {
      setError(errorMessage);
    } else {
      setError(null);
    }

    setFiles(prev => [...prev, ...validFiles.map(f => ({ file: f }))]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setError(null);

    try {
      const filePromises = files.map(async (f) => {
        return new Promise<{ mimeType: string; data: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result as string;
            // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
            const data = base64String.split(',')[1];
            resolve({
              mimeType: getMimeType(f.file),
              data: data
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(f.file);
        });
      });

      const processedFiles = await Promise.all(filePromises);
      const transactions = await parseDocumentsWithAI(processedFiles);
      
      if (transactions && transactions.length > 0) {
        onImport(transactions);
        onClose();
      } else {
        setError("No transactions found. Ensure the document contains clear trade details.");
      }

    } catch (err: any) {
      console.error(err);
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      
      if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
          setError("API Rate Limit Exceeded: You've reached the free tier limit. Please wait 60 seconds and try again, or switch to a paid API key.");
      } else if (msg.includes("403") || msg.includes("API key")) {
          setError("API Key Error: Please check your Google Gemini API key configuration.");
      } else if (msg.includes("400")) {
          setError("Bad Request: The file content might be unreadable or too large.");
      } else {
          setError(`Import Failed: ${msg.substring(0, 150)}...`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-6 flex justify-between items-center shrink-0">
          <h2 className="text-white text-xl font-bold flex items-center gap-2">
            <Upload className="text-emerald-400" /> Import Statements
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
           <div className="mb-6">
               <p className="text-slate-600 mb-4">
                   Upload brokerage statements (PDF), screenshots (JPG/PNG), or CSV files. 
                   Our AI will automatically extract transaction details.
               </p>
               
               <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'
                }`}
               >
                   <div className="flex flex-col items-center justify-center gap-3">
                       <div className="p-3 bg-slate-100 rounded-full text-slate-500">
                           <Upload size={24} />
                       </div>
                       <div className="text-sm text-slate-600">
                           <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
                       </div>
                       <p className="text-xs text-slate-400">PDF, PNG, JPG or CSV (max 10MB)</p>
                   </div>
                   <input 
                    type="file" 
                    multiple 
                    accept=".pdf,.csv,image/*" 
                    className="hidden" 
                    id="file-upload"
                    onChange={handleFileSelect}
                   />
                   <label htmlFor="file-upload" className="absolute inset-0 cursor-pointer"></label>
               </div>
           </div>

           {error && (
               <div className="mb-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-sm flex items-start gap-3">
                   <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-500" /> 
                   <div className="flex flex-col gap-1">
                       <span className="font-bold">Import Error</span>
                       <span>{error}</span>
                   </div>
               </div>
           )}

           {files.length > 0 && (
               <div className="space-y-2 mb-6">
                   <h3 className="text-sm font-semibold text-slate-700">Selected Files ({files.length})</h3>
                   {files.map((f, idx) => (
                       <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                           <div className="flex items-center gap-3 overflow-hidden">
                               <FileText className="text-indigo-500 shrink-0" size={20} />
                               <span className="text-sm text-slate-700 truncate">{f.file.name}</span>
                               <span className="text-xs text-slate-400">({(f.file.size / 1024).toFixed(0)} KB)</span>
                           </div>
                           <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-500 p-1">
                               <X size={16} />
                           </button>
                       </div>
                   ))}
               </div>
           )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">
                Cancel
            </button>
            <button 
                onClick={processFiles} 
                disabled={files.length === 0 || isProcessing}
                className="px-5 py-2 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="animate-spin" size={18} /> Processing...
                    </>
                ) : (
                    <>
                        <Upload size={18} /> Import Transactions
                    </>
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default FileImportModal;