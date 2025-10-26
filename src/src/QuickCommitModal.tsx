import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface QuickCommitModalProps {
  isOpen: boolean;
  projectPath: string;
  onClose: () => void;
  onCommit: (success: boolean, message: string) => void;
}

export const QuickCommitModal: React.FC<QuickCommitModalProps> = ({
  isOpen,
  projectPath,
  onClose,
  onCommit
}) => {
  const [promptMessage, setPromptMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveSnapshot = async () => {
    if (!promptMessage.trim()) {
      onCommit(false, '请输入 AI 指令');
      return;
    }

    if (!projectPath) {
      onCommit(false, '请先选择项目路径');
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
        setPromptMessage('');
        onCommit(true, result.message);
        onClose();
      } else {
        onCommit(false, result.message || '创建快照失败');
      }
    } catch (error) {
      onCommit(false, `创建快照失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSaveSnapshot();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        {/* 标题 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '15px',
          borderBottom: '2px solid #e9ecef'
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '20px',
            color: '#495057',
            fontWeight: 'bold'
          }}>
            💾 手动提交快照
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6c757d',
              padding: '5px',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ×
          </button>
        </div>

        {/* 输入区域 */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#495057'
          }}>
            AI 指令 / 提示词:
          </label>
          <textarea
            value={promptMessage}
            onChange={(e) => setPromptMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="请输入您的 AI 指令或描述本次修改的内容..."
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px',
              border: '2px solid #dee2e6',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.2s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#007bff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
          />
          <div style={{
            fontSize: '12px',
            color: '#6c757d',
            marginTop: '5px'
          }}>
            提示: 按 Ctrl+Enter (Mac: Cmd+Enter) 快速提交
          </div>
        </div>

        {/* 按钮区域 */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: isSubmitting ? 0.6 : 1,
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#5a6268';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.backgroundColor = '#6c757d';
              }
            }}
          >
            取消
          </button>
          <button
            onClick={handleSaveSnapshot}
            disabled={isSubmitting || !promptMessage.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: isSubmitting || !promptMessage.trim() ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isSubmitting || !promptMessage.trim() ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: isSubmitting || !promptMessage.trim() ? 0.6 : 1,
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting && promptMessage.trim()) {
                e.currentTarget.style.backgroundColor = '#218838';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting && promptMessage.trim()) {
                e.currentTarget.style.backgroundColor = '#28a745';
              }
            }}
          >
            {isSubmitting ? '🔄 提交中...' : '💾 保存快照'}
          </button>
        </div>
      </div>
    </div>
  );
};

