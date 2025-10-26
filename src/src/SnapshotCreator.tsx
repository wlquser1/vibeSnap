import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface SnapshotCreatorProps {
  projectPath: string;
  onSnapshotCreated: (success: boolean, message: string) => void;
}

export const SnapshotCreator: React.FC<SnapshotCreatorProps> = ({ 
  projectPath, 
  onSnapshotCreated 
}) => {
  const [promptMessage, setPromptMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveSnapshot = async () => {
    if (!promptMessage.trim()) {
      onSnapshotCreated(false, '请输入 AI 指令');
      return;
    }

    if (!projectPath) {
      onSnapshotCreated(false, '请先选择项目文件夹');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await invoke<{
        success: boolean;
        message: string;
        error?: string;
      }>('create_snapshot', { 
        projectPath: projectPath,
        promptMessage: promptMessage.trim()
      });

      if (result.success) {
        // 成功后清空输入框
        setPromptMessage('');
        onSnapshotCreated(true, result.message);
      } else {
        onSnapshotCreated(false, result.message + (result.error ? ` (${result.error})` : ''));
      }
    } catch (error) {
      onSnapshotCreated(false, `保存快照失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveSnapshot();
    }
  };

  return (
    <div style={{
      padding: '20px',
      margin: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #dee2e6'
    }}>
      <h3 style={{ 
        margin: '0 0 15px 0',
        color: '#495057',
        fontSize: '18px'
      }}>
        💾 保存 AI 快照
      </h3>
      
      <p style={{ 
        margin: '0 0 15px 0',
        color: '#6c757d',
        fontSize: '14px'
      }}>
        输入你的 AI 指令或提示词，系统将自动保存当前项目状态
      </p>

      <div style={{ marginBottom: '15px' }}>
        <textarea
          value={promptMessage}
          onChange={(e) => setPromptMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="例如：添加用户登录功能，优化页面布局，修复登录按钮样式..."
          style={{
            width: '100%',
            minHeight: '120px',
            padding: '12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
          disabled={isSubmitting}
        />
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <button
          onClick={handleSaveSnapshot}
          disabled={isSubmitting || !promptMessage.trim() || !projectPath}
          style={{
            padding: '12px 24px',
            backgroundColor: isSubmitting ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isSubmitting || !promptMessage.trim() || !projectPath ? 'not-allowed' : 'pointer',
            opacity: isSubmitting || !promptMessage.trim() || !projectPath ? 0.6 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          {isSubmitting ? '保存中...' : '💾 保存快照 (Save Snapshot)'}
        </button>

        <div style={{ 
          fontSize: '12px', 
          color: '#6c757d' 
        }}>
          快捷键: Ctrl+Enter (Windows) / Cmd+Enter (Mac)
        </div>
      </div>

      {promptMessage.trim() && (
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d9ff',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#0066cc'
        }}>
          <strong>预览提交信息:</strong> [Vibe] AI Prompt: {promptMessage.trim()}
        </div>
      )}
    </div>
  );
};
