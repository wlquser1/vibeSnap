import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel
}) => {
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
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        width: '90%',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
      }}>
        <h3 style={{
          margin: '0 0 16px 0',
          color: '#dc3545',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          ⚠️ {title}
        </h3>
        
        <p style={{
          margin: '0 0 24px 0',
          color: '#495057',
          fontSize: '14px',
          lineHeight: '1.5',
          whiteSpace: 'pre-line'
        }}>
          {message}
        </p>
        
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
