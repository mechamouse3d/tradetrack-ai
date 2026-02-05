import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { parseDocumentsWithAI } from '../services/geminiService';
import { Transaction } from '../types';

interface FileImportModalProps {
  onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
  onClose: () => void;
}

interface FileWithPreview {
  file: File;
  preview?: string;
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

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/') || 
      file.type === 'text/csv' || 
      file.type === 'application/vnd.ms-excel' ||
      file.name.toLowerCase().endsWith('.csv')
    );
    
    if (validFiles.length !== newFiles.length) {
      setError("Some files were skipped. Only PDF, Images, and CSV are supported.");
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
              mimeType: f.file.type || (f.file.name.endsWith('.csv') ? 'text/csv' : 'application/octet-stream'),
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
        setError("No transactions found in the provided documents. Please ensure the files contain clear trade details.");
      }

    } catch (err) {
      console.error(err);
      setError("Failed to process files. The document format might be unsupported or the AI could not extract the data.");
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
               <div className="mb-4 p-3 bg-rose-50 text-rose-600 rounded-lg text-sm flex items-center gap-2">
                   <AlertCircle size={16} /> {error}
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